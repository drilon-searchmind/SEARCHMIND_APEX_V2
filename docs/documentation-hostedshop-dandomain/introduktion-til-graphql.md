Introduktion til GraphQL
I denne artikel:
Hvad er GraphQL?
Hvad er fordelen ved at benytte GraphQL frem for REST?
Attention   

 

Hvad er GraphQL?
GraphQL er et sprog til forespørgsler (query language), og et runtime system. Klienten formulerer sine forespørgsler (kaldet queries og mutations) ved at benytte GraphQL's query language. GraphQL serveren eksekverer herefter forespørgslen og returnerer de ønskede data med sit response.

Klienten specificerer præcist hvilke data der ønskes, og serveren returnerer udelukkende de ønskede data. På denne måde sendes der ikke mere data end nødvendigt.

GraphQL minder om JSON. Følgende eksempel viser en simpel GraphQL-forespørgsel og det tilsvarende JSON response:

 

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
          "siteId": "1",
          "orderComment": null,
        }
      ]
    }
  }
}
 

 

Ser man bort fra top-level data nøglen i JSON-svaret, er strukturen af nøgler i svaret magen til strukturen i GraphQL forespørgslen.

 

Hvad er fordelen ved at benytte GraphQL frem for REST?
GraphQL adresserer flere af de problemstillinger som vil være velkendt for dem der har arbejdet med REST API.

REST | Hentning af relaterede data kræver ofte flere HTTP-kald
REST API er bygget på det princip at ethvert endpoint kun bør returnere én type af resurser. For eksempel, forespørgslen GET api.{shop_domain}/admin/products/1 returnerer information for produkt 1, men ikke yderligere. Dette betyder, hvis du vil have et produkts varianter, billeder, og metafelter, bliver du nød til at foretage mindst fire HTTP-kald.

REST | Apps modtager mere data end der er behov for
For at løse ovenstående problematik, ender vi med at afvige fra "ægte REST API", ved at indbygge bestemte relationer til udvalgte endpoints, når behovet foreligger. For eksempel, GET /products/1 returnerer information omkring produktet, men også omkring varianter, billeder og indstillinger. I sidste instans ender vi ud med et "one-size-fits-all" response, hvor vi ikke kan forespørge om mere eller mindre end der stilles til rådighed allerede.

REST | Hostedshop ved ikke hvilke data en app benytter
Når en app forespørger et REST endpoint, så har Hostedshop ikke nogen mulighed for at vide om alle returnerede data faktisk benyttes. Det svarer til at foretage en SELECT * forespørgsel til en SQL-database. Dette er problematisk når Hostedshop har behov for at foretage større ændringer, så som at fjerne en attribut fra et response. Her er det nærmest umuligt at vide hvem det påvirker. Vi ved hvilke klienter der kalder hvilke endpoints, men vi ved ikke hvilke af disse klienter der benytter den pågældende attribut. Nogle attributter er også tunge at beregne. Hvis vi allerede vidste at en app ikke benytter en tung attribut, behøvede vi ikke at beregne den i første omgang.

REST | REST API er ofte typesvagt og mangler maskinlæsbare metadata
Mens der findes nogle løsninger på problematikken med ikke at vide hvilke data der benyttes (så som et JSON-skema), er realiteten at de fleste REST API ikke supplerer denne type metadata. Resultatet er at apps bliver afhængige af dokumentation, som kan blive forældet eller ufuldstændig.

GRAPHQL | Alt er typestærkt og del af et skema
Alt hvad der er tilgængeligt igennem et GraphQL API, er inkluderet i dets skema. Du kan benytte skemaet til at bygge forespørgsler der udelukkende returnerer de data som du har brug for. Dette løser problemet omkring at hente flere data end nødvendigt. Det betyder også at vi ved hvilke felter hver app benytter, hvilket gør det lettere for os at videreudvikle på vores API.

GRAPHQL | Alt er tilgængeligt fra et enkelt endpoint
Alle GraphQL forespørgsler sendes til endpoint shop99999.mywebshop.io/api/graphql (Erstat "shop99999" med dit eget shop nummer), hvilket betyder at du ofte kan hente alle de data du behøver i et enkelt request. Ved at benytte GraphQL egenskaber som variabler og aliasser, er det muligt at lave dine forespørgsler meget effektive og hente data for mange typer af ressourcer i en enkelt forespørgsel.

GRAPHQL | Dokumentation er i første række
Dokumentationen for GraphQL API lever side om side med den kode, der udgør den. Kombineret med det typestærke skema, betyder dette at vi kan generere nøjagtig og ajourført dokumentation, når noget ændrer sig. Ved at benytte GraphQLs "introspection" funktionalitet, er det muligt at forespørge selve skemaet for at undersøge dets indhold og dokumentation.

GRAPHQL | Udfasning af funktionalitet er i første række
Vi kan let markere en del af vores skema som udfaset, og dette vil også afspejles i dokumentationen. GraphQL tooling, så som klient biblioteker, forventes også at kommunikere til udvikleren om, at der benyttes et udfaset værktøj.