import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SearchTerm {
  id: string;
  term: string;
  user_id: string;
}

// Simulated scraping function - In production, replace with actual Diário Oficial API or scraping
async function scrapeDiarioOficial(term: string): Promise<Array<{ title: string; content: string; date: string; url: string }>> {
  // This is a placeholder. In a real implementation, you would:
  // 1. Access the Diário Oficial API (if available) or
  // 2. Scrape the official website (e.g., https://www.in.gov.br/servicos/diario-oficial-da-uniao)
  
  // For demonstration, we'll return mock data when certain terms are found
  const mockPublications = [
    {
      title: "Edital de Licitação - Pregão Eletrônico",
      content: `Publicação referente a ${term} no Diário Oficial da União. Processo administrativo para aquisição de bens e serviços conforme especificações do edital.`,
      date: new Date().toISOString().split('T')[0],
      url: "https://www.in.gov.br/web/dou/-/exemplo-publicacao",
    },
    {
      title: "Portaria de Nomeação",
      content: `Nomeação relacionada a ${term}. O Ministro de Estado, no uso de suas atribuições, resolve nomear os candidatos aprovados em concurso público.`,
      date: new Date().toISOString().split('T')[0],
      url: "https://www.in.gov.br/web/dou/-/exemplo-portaria",
    },
  ];

  // Simulate finding results randomly for demonstration
  const shouldFindResults = Math.random() > 0.7; // 30% chance of finding results
  
  if (shouldFindResults) {
    return mockPublications.slice(0, Math.ceil(Math.random() * mockPublications.length));
  }
  
  return [];
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    
    // Create Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    let userId: string | null = null;

    // If authenticated, get user's terms only
    if (authHeader?.startsWith("Bearer ")) {
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      
      // Use getUser to validate the token and get user info
      const { data: userData, error: userError } = await userClient.auth.getUser();
      
      if (!userError && userData?.user) {
        userId = userData.user.id;
      }
    }

    // Create monitoring log
    const { data: logData, error: logError } = await supabase
      .from("monitoring_logs")
      .insert({ status: "running" })
      .select()
      .single();

    if (logError) {
      console.error("Error creating log:", logError);
    }

    const logId = logData?.id;

    // Get active search terms
    let termsQuery = supabase
      .from("search_terms")
      .select("*")
      .eq("is_active", true);

    if (userId) {
      termsQuery = termsQuery.eq("user_id", userId);
    }

    const { data: terms, error: termsError } = await termsQuery;

    if (termsError) {
      throw new Error(`Error fetching search terms: ${termsError.message}`);
    }

    if (!terms || terms.length === 0) {
      // Update log
      if (logId) {
        await supabase
          .from("monitoring_logs")
          .update({ status: "completed", results_count: 0, completed_at: new Date().toISOString() })
          .eq("id", logId);
      }

      return new Response(
        JSON.stringify({ message: "No active search terms found", resultsCount: 0 }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    let totalResults = 0;
    const userResults: Record<string, Array<{ term: string; results: any[] }>> = {};

    // Process each term
    for (const term of terms as SearchTerm[]) {
      const publications = await scrapeDiarioOficial(term.term);
      
      if (publications.length > 0) {
        // Insert results
        for (const pub of publications) {
          const { error: insertError } = await supabase.from("search_results").insert({
            search_term_id: term.id,
            user_id: term.user_id,
            title: pub.title,
            content: pub.content,
            publication_date: pub.date,
            source_url: pub.url,
            was_notified: false,
          });

          if (insertError) {
            console.error("Error inserting result:", insertError);
          } else {
            totalResults++;
            
            // Group results by user for notification
            if (!userResults[term.user_id]) {
              userResults[term.user_id] = [];
            }
            userResults[term.user_id].push({ term: term.term, results: publications });
          }
        }
      }
    }

    // Send notifications to users with new results
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    
    if (resendApiKey && Object.keys(userResults).length > 0) {
      for (const [resultUserId, termResults] of Object.entries(userResults)) {
        // Get user profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", resultUserId)
          .single();

        if (profile && profile.notification_enabled && profile.email) {
          await sendNotificationEmail(resendApiKey, profile.email, termResults);
          
          // Mark results as notified
          for (const tr of termResults) {
            for (const result of tr.results) {
              await supabase
                .from("search_results")
                .update({ was_notified: true })
                .eq("user_id", resultUserId)
                .eq("content", result.content);
            }
          }
        }
      }
    }

    // Update log
    if (logId) {
      await supabase
        .from("monitoring_logs")
        .update({ status: "completed", results_count: totalResults, completed_at: new Date().toISOString() })
        .eq("id", logId);
    }

    return new Response(
      JSON.stringify({ 
        message: "Scraping completed", 
        resultsCount: totalResults,
        termsProcessed: terms.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );

  } catch (error: any) {
    console.error("Error in scrape-diario-oficial function:", error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

async function sendNotificationEmail(
  apiKey: string, 
  email: string, 
  termResults: Array<{ term: string; results: any[] }>
): Promise<void> {
  try {
    const resultsHtml = termResults.map(tr => `
      <div style="margin-bottom: 20px;">
        <h3 style="color: #333; border-bottom: 1px solid #ddd; padding-bottom: 8px;">
          Termo: "${tr.term}"
        </h3>
        ${tr.results.map(r => `
          <div style="background: #f9f9f9; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
            <strong>${r.title}</strong>
            <p style="color: #666; margin: 10px 0;">${r.content.substring(0, 200)}...</p>
            <a href="${r.url}" style="color: #0066cc;">Ver publicação completa</a>
          </div>
        `).join('')}
      </div>
    `).join('');

    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Monitor Diário Oficial <onboarding@resend.dev>",
        to: [email],
        subject: `🔔 Novas publicações encontradas no Diário Oficial`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Monitor Diário Oficial</h2>
            <p>Encontramos novas publicações que correspondem aos seus termos de busca:</p>
            ${resultsHtml}
            <hr style="border: none; border-top: 1px solid #ddd; margin: 30px 0;">
            <p style="color: #999; font-size: 12px;">
              Este é um e-mail automático do sistema de monitoramento do Diário Oficial.
              Você pode desativar as notificações no painel de controle.
            </p>
          </div>
        `,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error("Resend API error:", errorData);
    } else {
      console.log("Notification email sent to:", email);
    }
  } catch (error) {
    console.error("Error sending email:", error);
  }
}

serve(handler);
