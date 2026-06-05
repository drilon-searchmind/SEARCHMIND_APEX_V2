Eksempler
I denne artikel:
Hent ordrer
Brug af pagination
Brug af sortering
Brug af søgning
Det hele i kombination
Eksempel i .NET/C#
Attention   

 

I følgende eksempel går vi ud fra en shop med 42 ordrer i alt.

 

Hent ordrer
Hvis vi vil hente ID, sprog, site ID og ordrekommentarer for alle ordrer i shoppen, kan vi benytte følgende forespørgsel:

POST

query {
  orders {
    data {
      id
      languageISO
      siteId
      orderComment
    }
  }
}
Endpoint:
shop99999.mywebshop.io/api/graphql
(Erstat "shop99999" med dit eget shop nummer)

Response

{
  "data": {
    "orders": {
      "data": [
        {
          "id": "1",
          "languageISO": "DK",
          "siteId": "1"
        },
        ...,
        {
          "id": "42",
          "languageISO": "DK",
          "siteId": "1"
        }
      ]
    }
  }
}
 

 

Brug af pagination
For at begrænse antallet af returnerede resultater, kan vi supplere med paginationsmuligheder. Følgende forespørgsel demonstrerer hentning af højst 2 ordrer per side, med resultater fra side 3:

POST

query {
  orders (pagination:{
    limit: 2,
    page: 3
  }) {
    pagination {
      currentPage
      from
      perPage
      to
      total
    }
    data {
      id
      languageISO
      siteId
    }
  }
}
Endpoint:
shop99999.mywebshop.io/api/graphql

Response

{
  "data": {
    "orders": {
      "pagination": {
        "currentPage": 3,
        "from": 5,
        "perPage": 2,
        "to": 6,
        "total": 6
      },
      "data": [
        {
          "id": "8",
          "languageISO": "DK",
          "siteId": "1"
        },
        {
          "id": "9",
          "languageISO": "DK",
          "siteId": "1"
        }
      ]
    }
  }
}
 

 

Brug af sortering
Det er ligeledes muligt at sortere de returnerede resultater i forhold til et givent felt, i en given ordre:

POST


query {
  orders (order:{
    field: id,
    direction: DESC
  }) {
    data {
      id
    }
  }
}
Endpoint:
shop99999.mywebshop.io/api/graphql

Response


{
  "data": {
    "orders": {
      "data": [
        {
          "id": "42"
        },
        {
          "id": "41"
        },
        ...,
        {
          "id": "1"
        }
      ]
    }
  }
}
 

 

Brug af søgning
En anden måde at begrænse de returnerede resultater på, er ved at benytte søgeparametre. Følgende eksempel viser hvordan man henter alle ordrer, med ordre ID mindre end 3, og større end 41:

POST


query {
  orders (search:[
    {
      field: id,
      comparator: LESS_THAN
      value:"3"
    },
    {
      field: id,
      comparator: GREATER_THAN
      value:"41",
      operator:OR
    }
  ]) {
    data {
      id
    }
  }
}
Endpoint:
shop99999.mywebshop.io/api/graphql

Response


{
  "data": {
    "orders": {
      "data": [
        {
          "id": "1"
        },
        {
          "id": "2"
        },
        {
          "id": "42"
        }
      ]
    }
  }
}
 

 

Det hele i kombination
Vi kan kombinere alle ovenstående eksempler i en enkelt forespørgsel:

POST


query {
  orders(
    pagination:{limit:3,page:2}
    order:{field:id, direction:DESC}
    search: [{field: id, comparator: GREATER_THAN, value: "30"}]
  ) {
    data {
      id
      createdAt
    }
  }
}
Endpoint:
shop99999.mywebshop.io/api/graphql

Response


{
  "data": {
    "orders": {
      "data": [
        {
          "id": "39",
          "createdAt": "2019-04-08T09:09:44+00:00"
        },
        {
          "id": "38",
          "createdAt": "2019-04-08T08:36:43+00:00"
        },
        {
          "id": "37",
          "createdAt": "2019-04-05T14:10:05+00:00"
        }
      ]
    }
  }
}
 

Eksempel i .NET/C#
    
    using System;
    using System.Threading.Tasks;
    using System.Text.Json;
    using System.Net.Http.Headers;
    using System.Net.Http;

    // This example uses https://github.com/graphql-dotnet/graphql-client
    using GraphQL;
    using GraphQL.Client.Http;

    namespace GraphQlClientDemo
    {
        class Program
        {
            static void Main(string[] args)
            {
                MainAsync().Wait();
            }

            static async Task MainAsync()
            {
                var client = new System.Net.Http.HttpClient();

                // Check https://help.hostedshop.dk/authentication/ for information about how to obtain the access token
                client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", "<client token>");

                // Replace "shop99999" with your own shop number
                var options = new GraphQLHttpClientOptions()
                {
                    EndPoint = new Uri("https://shop99999.mywebshop.io/api/graphql")
                };

                // Set up the client
                var graphQLClient = new GraphQLHttpClient(options, client);

                // Prepare a request to fetch all orders with id, languageISO and siteId
                var ordersRequest = new GraphQLRequest
                {
                  Query = @"
                    query {
                      orders {
                        data {
                          id
                          languageISO
                          siteId
                        }
                      }
                   }"
                };

                // Send the request and store the response as an OrderResponse object
                var graphQLResponse = await graphQLClient.SendQueryAsync<OrderResponse>(ordersRequest);

                // Write out the response in the console
                Console.WriteLine(JsonSerializer.Serialize(graphQLResponse, new JsonSerializerOptions { WriteIndented = true }));

                // Wait for a key to be pressed before closing down
                Console.WriteLine("Press any key to quit...");
                Console.ReadKey();
            }
        }

        public class OrderResponse
        {
            public Orders orders { get; set; }

            public class Orders
            {
            public Data[] data { get; set; }
            }

            public class Data
            {
                public string Id { get; set; }
                public string LanguageISO { get; set; }
                public int SiteId { get; set; }
            }
        }
    }
