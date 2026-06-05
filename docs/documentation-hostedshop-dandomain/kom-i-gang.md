Kom i gang
Attention   

 

Endpoint
GraphQL API har ét enkelt endpoint:

POST https://shop99999.mywebshop.io/api/graphql
(Erstat "shop99999" med dit eget shop nummer)

 

Authentication
For mere information vedr. opsætning af authentication til Hostedshop, se Authentication

 

Forespørgsel til API
Du kan tilgå endpoint for GraphQL API med cURL, og enhver anden HTTP klient. Med følgende eksempel, skal du huske at bytte {shop_domain} med din webshops domæne og med det token som du genererer via sektionen Authentication

 

curl
For at foretage en forespørgsel med curl, send et POST request med din forespørgsel som JSON payload:

    
        curl -X POST \
        "https://shop99999.mywebshop.io/api/graphql" \
        -H "Content-Type: application/graphql" \
        -H "Authorization: Bearer " \
        -d '
        {
        query {
            orders {
              data {
                id
                languageISO
                siteId
              }
            }
        }
        }
        '
    
 