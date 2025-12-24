---
title: shopifyqlQuery - GraphQL Admin
description: |-
  Executes a [ShopifyQL query](https://shopify.dev/docs/api/shopifyql/segment-query-language-reference) to analyze store data and returns results in a tabular format.

  The response includes column metadata with names, data types, and display names, along with the actual data rows. If the query contains syntax errors, then the response provides parse error messages instead of table data.
api_version: 2025-10
api_name: admin
type: query
api_type: graphql
source_url:
  html: https://shopify.dev/docs/api/admin-graphql/latest/queries/shopifyqlquery
  md: https://shopify.dev/docs/api/admin-graphql/latest/queries/shopifyqlquery.md
---

# shopifyql​Query

query

Requires `read_reports` access scope. Also: Level 2 access to Customer data including name, address, phone, and email fields. Please refer to <https://shopify.dev/docs/apps/launch/protected-customer-data>.

Executes a [ShopifyQL query](https://shopify.dev/docs/api/shopifyql/segment-query-language-reference) to analyze store data and returns results in a tabular format.

The response includes column metadata with names, data types, and display names, along with the actual data rows. If the query contains syntax errors, then the response provides parse error messages instead of table data.

## Arguments

* query

  [String!](https://shopify.dev/docs/api/admin-graphql/latest/scalars/String)

  required

  A ShopifyQL query.

***

## Possible returns

* Shopifyql​Query​Response

  [Shopifyql​Query​Response](https://shopify.dev/docs/api/admin-graphql/latest/objects/ShopifyqlQueryResponse)

  A response to a ShopifyQL query.

  * parse​Errors

    [\[String!\]!](https://shopify.dev/docs/api/admin-graphql/latest/scalars/String)

    non-null

    A list of parse errors, if parsing fails.

  * table​Data

    [Shopifyql​Table​Data](https://shopify.dev/docs/api/admin-graphql/latest/objects/ShopifyqlTableData)

    The result in a tabular format with column and row data.

***

## Examples

* ### Get a table data response using ShopifyQL query.

  #### Description

  Uses a ShopifyQL query to retrieve data that's structured in a table format.

  #### Query

  ```graphql
  query {
    shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month") {
      tableData {
        columns {
          name
          dataType
          displayName
        }
        rows
      }
      parseErrors
    }
  }
  ```

  #### cURL

  ```bash
  curl -X POST \
  https://your-development-store.myshopify.com/admin/api/2025-10/graphql.json \
  -H 'Content-Type: application/json' \
  -H 'X-Shopify-Access-Token: {access_token}' \
  -d '{
  "query": "query { shopifyqlQuery(query: \"FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month\") { tableData { columns { name dataType displayName } rows } parseErrors } }"
  }'
  ```

  #### React Router

  ```javascript
  import { authenticate } from "../shopify.server";

  export const loader = async ({request}) => {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
      `#graphql
    query {
      shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month") {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }`,
    );
    const json = await response.json();
    return json.data;
  }
  ```

  #### Ruby

  ```ruby
  session = ShopifyAPI::Auth::Session.new(
    shop: "your-development-store.myshopify.com",
    access_token: access_token
  )
  client = ShopifyAPI::Clients::Graphql::Admin.new(
    session: session
  )

  query = <<~QUERY
    query {
      shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month") {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }
  QUERY

  response = client.query(query: query)
  ```

  #### Node.js

  ```javascript
  const client = new shopify.clients.Graphql({session});
  const data = await client.query({
    data: `query {
      shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month") {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }`,
  });
  ```

  #### Response

  ```json
  {
    "shopifyqlQuery": {
      "tableData": {
        "columns": [
          {
            "name": "month",
            "dataType": "MONTH_TIMESTAMP",
            "displayName": "Month"
          },
          {
            "name": "total_sales",
            "dataType": "MONEY",
            "displayName": "Total sales"
          }
        ],
        "rows": [
          {
            "month": "2025-01-01",
            "total_sales": "123.456"
          }
        ]
      },
      "parseErrors": []
    }
  }
  ```

* ### Get a table data response with generated columns using ShopifyQL query.

  #### Description

  Uses a ShopifyQL query to retrieve data that's structured in a table format with generated columns.

  #### Query

  ```graphql
  query {
    shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month WITH TOTALS") {
      tableData {
        columns {
          name
          dataType
          displayName
        }
        rows
      }
      parseErrors
    }
  }
  ```

  #### cURL

  ```bash
  curl -X POST \
  https://your-development-store.myshopify.com/admin/api/2025-10/graphql.json \
  -H 'Content-Type: application/json' \
  -H 'X-Shopify-Access-Token: {access_token}' \
  -d '{
  "query": "query { shopifyqlQuery(query: \"FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month WITH TOTALS\") { tableData { columns { name dataType displayName } rows } parseErrors } }"
  }'
  ```

  #### React Router

  ```javascript
  import { authenticate } from "../shopify.server";

  export const loader = async ({request}) => {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
      `#graphql
    query {
      shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month WITH TOTALS") {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }`,
    );
    const json = await response.json();
    return json.data;
  }
  ```

  #### Ruby

  ```ruby
  session = ShopifyAPI::Auth::Session.new(
    shop: "your-development-store.myshopify.com",
    access_token: access_token
  )
  client = ShopifyAPI::Clients::Graphql::Admin.new(
    session: session
  )

  query = <<~QUERY
    query {
      shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month WITH TOTALS") {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }
  QUERY

  response = client.query(query: query)
  ```

  #### Node.js

  ```javascript
  const client = new shopify.clients.Graphql({session});
  const data = await client.query({
    data: `query {
      shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month WITH TOTALS") {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }`,
  });
  ```

  #### Response

  ```json
  {
    "shopifyqlQuery": {
      "tableData": {
        "columns": [
          {
            "name": "month",
            "dataType": "MONTH_TIMESTAMP",
            "displayName": "Month"
          },
          {
            "name": "total_sales",
            "dataType": "MONEY",
            "displayName": "Total sales"
          },
          {
            "name": "total_sales__totals",
            "dataType": "MONEY",
            "displayName": "Total sales (totals)"
          }
        ],
        "rows": [
          {
            "month": "2025-01-01",
            "total_sales": "123.456",
            "total_sales__totals": "1234.56"
          }
        ]
      },
      "parseErrors": []
    }
  }
  ```

* ### Handle Parse error in ShopifyQL query

  #### Description

  An example of handling a parsing error from a ShopifyQL query.

  #### Query

  ```graphql
  query {
    shopifyqlQuery(query: "FROM sales SHOW total_sale") {
      tableData {
        columns {
          name
          dataType
          displayName
        }
        rows
      }
      parseErrors
    }
  }
  ```

  #### cURL

  ```bash
  curl -X POST \
  https://your-development-store.myshopify.com/admin/api/2025-10/graphql.json \
  -H 'Content-Type: application/json' \
  -H 'X-Shopify-Access-Token: {access_token}' \
  -d '{
  "query": "query { shopifyqlQuery(query: \"FROM sales SHOW total_sale\") { tableData { columns { name dataType displayName } rows } parseErrors } }"
  }'
  ```

  #### React Router

  ```javascript
  import { authenticate } from "../shopify.server";

  export const loader = async ({request}) => {
    const { admin } = await authenticate.admin(request);
    const response = await admin.graphql(
      `#graphql
    query {
      shopifyqlQuery(query: "FROM sales SHOW total_sale") {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }`,
    );
    const json = await response.json();
    return json.data;
  }
  ```

  #### Ruby

  ```ruby
  session = ShopifyAPI::Auth::Session.new(
    shop: "your-development-store.myshopify.com",
    access_token: access_token
  )
  client = ShopifyAPI::Clients::Graphql::Admin.new(
    session: session
  )

  query = <<~QUERY
    query {
      shopifyqlQuery(query: "FROM sales SHOW total_sale") {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }
  QUERY

  response = client.query(query: query)
  ```

  #### Node.js

  ```javascript
  const client = new shopify.clients.Graphql({session});
  const data = await client.query({
    data: `query {
      shopifyqlQuery(query: "FROM sales SHOW total_sale") {
        tableData {
          columns {
            name
            dataType
            displayName
          }
          rows
        }
        parseErrors
      }
    }`,
  });
  ```

  #### Response

  ```json
  {
    "shopifyqlQuery": {
      "tableData": null,
      "parseErrors": [
        "Column Not Found: Column 'total_sale' not found"
      ]
    }
  }
  ```

[Open in GraphiQL](http://localhost:3457/graphiql?query=query%20%7B%0A%20%20shopifyqlQuery\(query%3A%20%22FROM%20sales%20SHOW%20total_sales%20GROUP%20BY%20month%20SINCE%20-3m%20ORDER%20BY%20month%22\)%20%7B%0A%20%20%20%20tableData%20%7B%0A%20%20%20%20%20%20columns%20%7B%0A%20%20%20%20%20%20%20%20name%0A%20%20%20%20%20%20%20%20dataType%0A%20%20%20%20%20%20%20%20displayName%0A%20%20%20%20%20%20%7D%0A%20%20%20%20%20%20rows%0A%20%20%20%20%7D%0A%20%20%20%20parseErrors%0A%20%20%7D%0A%7D)

##### GQL

```graphql
query {
  shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month") {
    tableData {
      columns {
        name
        dataType
        displayName
      }
      rows
    }
    parseErrors
  }
}
```

##### cURL

```bash
curl -X POST \
https://your-development-store.myshopify.com/admin/api/2025-10/graphql.json \
-H 'Content-Type: application/json' \
-H 'X-Shopify-Access-Token: {access_token}' \
-d '{
"query": "query { shopifyqlQuery(query: \"FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month\") { tableData { columns { name dataType displayName } rows } parseErrors } }"
}'
```

##### React Router

```javascript
import { authenticate } from "../shopify.server";

export const loader = async ({request}) => {
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
  query {
    shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month") {
      tableData {
        columns {
          name
          dataType
          displayName
        }
        rows
      }
      parseErrors
    }
  }`,
  );
  const json = await response.json();
  return json.data;
}
```

##### Node.js

```javascript
const client = new shopify.clients.Graphql({session});
const data = await client.query({
  data: `query {
    shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month") {
      tableData {
        columns {
          name
          dataType
          displayName
        }
        rows
      }
      parseErrors
    }
  }`,
});
```

##### Ruby

```ruby
session = ShopifyAPI::Auth::Session.new(
  shop: "your-development-store.myshopify.com",
  access_token: access_token
)
client = ShopifyAPI::Clients::Graphql::Admin.new(
  session: session
)

query = <<~QUERY
  query {
    shopifyqlQuery(query: "FROM sales SHOW total_sales GROUP BY month SINCE -3m ORDER BY month") {
      tableData {
        columns {
          name
          dataType
          displayName
        }
        rows
      }
      parseErrors
    }
  }
QUERY

response = client.query(query: query)
```

## Response

JSON

```json
{
  "shopifyqlQuery": {
    "tableData": {
      "columns": [
        {
          "name": "month",
          "dataType": "MONTH_TIMESTAMP",
          "displayName": "Month"
        },
        {
          "name": "total_sales",
          "dataType": "MONEY",
          "displayName": "Total sales"
        }
      ],
      "rows": [
        {
          "month": "2025-01-01",
          "total_sales": "123.456"
        }
      ]
    },
    "parseErrors": []
  }
}
```