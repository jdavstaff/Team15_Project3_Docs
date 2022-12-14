const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const { Pool } = require("pg");
const { Translate } = require("@google-cloud/translate").v2;

dotenv.config({ path: "./.env" });
const PORT = process.env.PORT || 1111; // this needs to match proxy in front-end package.json

const app = express();
app.use(cors());
app.use(express.static(path.join(__dirname + "/build")));

// Credentials for Google Translate
const CREDS = JSON.parse(process.env.GOOGLE_TRANSLATE_KEY);

// Create google translate info object
const TRANSLATE = new Translate({
  projectId: CREDS.project_id,
  credentials: CREDS
});

// start database connection
const connectionParams = {
  connectionString: process.env.URL,
  ssl: {
    rejectUnauthorized: false,
  },
};
const pool = new Pool(connectionParams);
pool.connect();


// start listening
app.listen(PORT, () => console.log("Server on PORT: " + PORT));

// Request to translate a phrase
app.get("/translate", async (req, res) => {
  let target = req.query.target // Default to spanish for now
  let [translations] = await TRANSLATE.translate(req.query.text, target);
  res.send(translations);
})

// Request for available languages
app.get("/languages", async (req, res) => {
  const [languages] = await TRANSLATE.getLanguages();
  res.send(languages);
})

app.get("/orders", (req, response) => {});

app.get("/googleIdentity", (req, response) => {
  response.json({id: process.env.GOOGLE_IDENTITY_CLIENT_ID})
})

app.get("/permission", (req, response) => {
  let email = req.query.email
  let name = req.query.name
  console.log('permissions endpoint')
  console.log(pool)
  pool.query(`SELECT PERMISSION FROM USERS WHERE EMAIL = $1`, [email], (err, res) => {
    if(err) {
      console.log(err)
      response.json({err: err})
      return
    }
    if(res.rows.length === 0) { // if the user does not exist in table
      // create new user
      pool.query(`INSERT INTO USERS VALUES ($1, $2, $3, 0)`, [email, name.first, name.last], (err, res) => {
        if(err) {
          console.log(err)
          response.json({err: err})
          return
        }
        console.log('created new user')
        response.json({message: `Created new user: ${name.first} ${name.last}`, permission: 0})
      })
    }
    else { // if the user does exist
      console.log('rows ' + res.rows)
      response.json({message: `Welcome back ${name.first}!`, permission: res.rows[0].permission})
    }
  })
})

app.get("/inventory", (req, response) => {
  pool.query(`SELECT * FROM INVENTORY ORDER BY INGREDIENT_ID`, (err, res) => {
    if (err) {
      response.json({ err: err });
      return;
    }
    response.json({ rows: res.rows });
  });
});

app.get("/addInventory", (req, response) => {
  let name = req.query.name;
  let quantity = req.query.quantity;
  pool.query(`INSERT INTO INVENTORY(NAME, QUANTITY) VALUES ($1, $2)`, [name, quantity], 
    (err, res) => {
      if (err) {
        console.log(err);
        response.json({ err: err });
        return;
      }
      response.json({ rows: res.rows });
    }
  );
})

app.get('/updateInventory', (req, response) => {
  let id = req.query.id
  let name = req.query.name
  let quantity = req.query.quantity
  console.log(id + ' ' + name + ' ' + quantity)
  let query = `UPDATE INVENTORY SET NAME = $1, QUANTITY = $2 WHERE INGREDIENT_ID = $3`
  pool.query(query, [name, quantity, id], (err, res) => {
    if(err) {
      console.log(err)
      response.json({err: err})
      return
    }
    response.json({err: false})
  })
})

app.get("/getInvID", (req, response) => {
  let name = req.query.name;
  pool.query(`SELECT INGREDIENT_ID FROM INVENTORY WHERE NAME=$1`, [name],
    (err, res) => {
      if (err) {
        console.log(err);
        response.json({ err: err });
        return;
      }
      console.log(res);
      response.json({ rows: res.rows });
    })
})

app.get("/itemIngredients", (req, response) => {
  pool.query(
    `SELECT ITEM.NAME AS ITEM, ITEM.ID, ITEM.EXTRA_PRICE, ITEM.CATEGORY, INVENTORY.NAME AS INGREDIENT_NAME, INVENTORY.INGREDIENT_ID, ITEM_INGREDIENTS.AMOUNT FROM ITEM JOIN ITEM_INGREDIENTS ON ITEM.ID = ITEM_INGREDIENTS.ITEM_ID JOIN INVENTORY ON INVENTORY.INGREDIENT_ID = ITEM_INGREDIENTS.INVENTORY_ID`,
    (err, res) => {
      if (err) {
        response.json({ err: err });
        return;
      }
      response.json({ rows: res.rows });
    }
  );
});

app.get("/invDelete", (req, response) => {
  let input = req.query;
  pool.query(
    `DELETE FROM INVENTORY WHERE INGREDIENT_ID=${input.id}`,
    (err, res) => {
      if (err) {
        response.json({ err: err });
        return;
      }
      response.json({ rows: res.rows });
    }
  );
});

app.get("/items", (req, response) => {
  pool.query(
    `SELECT * FROM ITEM WHERE CATEGORY = 'Entree' OR CATEGORY = 'Side' OR CATEGORY = 'Appetizer'`,
    (err, res) => {
      if (err) {
        response.json({ err: err });
        return;
      }
      response.json({ rows: res.rows });
    }
  );
});

app.get("/salesReport", (req, response) => {
  let queryThing = `SELECT ITEM.NAME, SUM(AMOUNT) AS AMOUNT_SOLD FROM TICKET JOIN ORDERS ON TICKET.ID = ORDERS.TICKET_ID JOIN BRIDGE ON ORDERS.ID = BRIDGE.ORDER_ID JOIN ITEM ON BRIDGE.ITEM_ID = ITEM.ID WHERE TICKET.ORDER_TIME BETWEEN (TIMESTAMP '${req.query.start}' AT TIME ZONE 'UTC' AT TIME ZONE 'CST') AND (TIMESTAMP '${req.query.end}' AT TIME ZONE 'UTC' AT TIME ZONE 'CST') GROUP BY ITEM.NAME ORDER BY SUM(AMOUNT) DESC`;

  pool.query(queryThing, (err, res) => {
    if (err) {
      response.json({ err: err });
      return;
    }
    response.json({ rows: res.rows });
  });
});

app.get("/placeOrder", (req, response) => {
  let prices = {
    Bowl: 6.4,
    Plate: 7.9,
    "Bigger Plate": 9.4,
    Appetizer: 1.9,
    Drink: 0,
  };

  let input = req.query.data;
  let totalPrice = 0;
  let totalItems = 0;
  input.forEach((order) => {
    totalPrice += parseFloat(prices[order.size]);
    order.items.forEach((item) => {
      totalPrice += parseFloat(item.extra_price);
      totalItems++;
    });
  });

  let i = 0; // keeps track of how many items have been inserted

  // im sorry this has to be nested like this, you can only insert things asynchronously and this is the only way to make sure it is in the right order
  let query = `INSERT INTO TICKET(ORDER_TIME, TOTAL_PRICE) VALUES (NOW() AT TIME ZONE 'US/Central', $1) RETURNING ID`;
  // insert ticket
  pool
    .query(query, [totalPrice])
    .then((res) => {
      let ticketId = res.rows[0].id;
      input.forEach((order) => {
        // insert orders
        query = `INSERT INTO ORDERS(TICKET_ID, SIZE_ID) VALUES ($1, (SELECT ID FROM SIZE WHERE NAME = $2)) RETURNING ID`;
        pool
          .query(query, [ticketId, order.size])
          .then((res2) => {
            let orderId = res2.rows[0].id;
            order.items.forEach((item) => {
              // insert items
              query = `INSERT INTO BRIDGE(ORDER_ID, ITEM_ID, AMOUNT) VALUES ($1, $2,
                    (SELECT CASE WHEN CATEGORY = 'Side' THEN 2 ELSE 1 END FROM ITEM WHERE ID = $2))
                    ON CONFLICT (ORDER_ID, ITEM_ID) DO UPDATE SET AMOUNT = BRIDGE.AMOUNT+1`;
              pool
                .query(query, [orderId, item.id])
                .then((res3) => {
                  i++; // number of items inserted incremented

                  if (i == totalItems) {
                    // this is the last item
                    // do decrements to inventory (important that this runs once at the end)
                    query = `WITH DECREMENT AS (
                                        SELECT 
                                            INVENTORY.INGREDIENT_ID, 
                                            SUM(BRIDGE.AMOUNT * ITEM_INGREDIENTS.AMOUNT) AS D 
                                        FROM TICKET 
                                        JOIN ORDERS 
                                            ON TICKET.ID = ORDERS.TICKET_ID 
                                        JOIN BRIDGE 
                                            ON ORDERS.ID = BRIDGE.ORDER_ID 
                                        JOIN ITEM 
                                            ON BRIDGE.ITEM_ID = ITEM.ID 
                                        JOIN ITEM_INGREDIENTS 
                                            ON ITEM.ID = ITEM_INGREDIENTS.ITEM_ID 
                                        JOIN INVENTORY
                                            ON ITEM_INGREDIENTS.INVENTORY_ID = INVENTORY.INGREDIENT_ID 
                                        WHERE TICKET.ID = (SELECT MAX(ID) FROM TICKET) 
                                        GROUP BY INVENTORY.INGREDIENT_ID
                                    ) 
                                    UPDATE INVENTORY 
                                    SET QUANTITY = QUANTITY - DECREMENT.D 
                                    FROM DECREMENT 
                                    WHERE DECREMENT.INGREDIENT_ID = INVENTORY.INGREDIENT_ID`;
                    pool.query(query, (err, res) => {
                      if (err) {
                        console.log(err);
                      }
                    });

                    query = `WITH DECREMENT AS (
                                        SELECT 
                                            DISTINCT SIZE.NAME AS SIZE, 
                                            COUNT(SIZE.NAME) AS D 
                                        FROM TICKET 
                                        JOIN ORDERS 
                                            ON ORDERS.TICKET_ID = TICKET.ID 
                                        JOIN SIZE 
                                            ON SIZE.ID = ORDERS.SIZE_ID 
                                        JOIN INVENTORY 
                                            ON INVENTORY.NAME = SIZE.NAME 
                                        WHERE TICKET_ID = (SELECT MAX(ID) FROM TICKET) 
                                        GROUP BY SIZE.NAME
                                    ) 
                                    UPDATE INVENTORY 
                                    SET QUANTITY = INVENTORY.QUANTITY - DECREMENT.D 
                                    FROM DECREMENT 
                                    WHERE INVENTORY.NAME = DECREMENT.SIZE`;
                    pool.query(query, (err, res) => {
                      if (err) {
                        console.log(err);
                      }
                    });
                  }
                })
                .catch((err3) => {
                  console.log(err3);
                });
            });
          })
          .catch((err2) => {
            console.log(err2);
          });
      });
    }).catch((err) => {
       console.log(err)
    })
    
    response.json({err: false})
})

app.get('/excessReport', (req, response) => {
    let queryThing = `WITH SOLD AS (SELECT INVENTORY.NAME AS NAME, SUM(BRIDGE.AMOUNT * ITEM_INGREDIENTS.AMOUNT) AS AMOUNT FROM TICKET JOIN ORDERS ON ORDERS.TICKET_ID = TICKET.ID JOIN BRIDGE ON ORDERS.ID = BRIDGE.ORDER_ID JOIN ITEM ON BRIDGE.ITEM_ID = ITEM.ID JOIN ITEM_INGREDIENTS ON ITEM_INGREDIENTS.ITEM_ID = ITEM.ID JOIN INVENTORY ON ITEM_INGREDIENTS.INVENTORY_ID = INVENTORY.INGREDIENT_ID WHERE ORDER_TIME > (TIMESTAMP '${req.query.start}' AT TIME ZONE 'UTC' AT TIME ZONE 'CST') GROUP BY INVENTORY.NAME) SELECT ITEM.NAME AS ITEM_NAME, INVENTORY.NAME AS INGREDIENT_NAME, SOLD.AMOUNT / (SOLD.AMOUNT + INVENTORY.QUANTITY * 1.0) AS PERCENT_SOLD, SOLD.AMOUNT AS AMOUNT_SOLD, INVENTORY.QUANTITY + SOLD.AMOUNT AS TOTAL_QUANTITY FROM INVENTORY JOIN SOLD ON INVENTORY.NAME = SOLD.NAME JOIN ITEM_INGREDIENTS ON INVENTORY.INGREDIENT_ID = ITEM_INGREDIENTS.INVENTORY_ID JOIN ITEM ON ITEM_INGREDIENTS.ITEM_ID = ITEM.ID WHERE SOLD.AMOUNT / (SOLD.AMOUNT + INVENTORY.QUANTITY * 1.0) < 0.1`
    
    pool.query(queryThing, (err, res) => {
        if(err) {
            response.json({err: err})
            return
        }
        response.json({rows: res.rows})
    })
})

app.get('/restockReport', (req, response) => {
    let queryThing = `WITH SOLD AS (SELECT INVENTORY.NAME AS NAME,SUM(BRIDGE.AMOUNT * ITEM_INGREDIENTS.AMOUNT) AS AMOUNT FROM TICKET JOIN ORDERS ON ORDERS.TICKET_ID = TICKET.ID JOIN BRIDGE ON ORDERS.ID = BRIDGE.ORDER_ID JOIN ITEM ON BRIDGE.ITEM_ID = ITEM.ID JOIN ITEM_INGREDIENTS ON ITEM_INGREDIENTS.ITEM_ID = ITEM.ID JOIN INVENTORY ON ITEM_INGREDIENTS.INVENTORY_ID = INVENTORY.INGREDIENT_ID WHERE ORDER_TIME > NOW() AT TIME ZONE 'US/Central'  - INTERVAL '7 DAYS' GROUP BY INVENTORY.NAME) SELECT INVENTORY.NAME, INVENTORY.QUANTITY AS CURRENT_AMOUNT, SOLD.AMOUNT AS LAST_7_DAYS_SALES, ROUND(SOLD.AMOUNT * 1.1 - INVENTORY.QUANTITY) AS RECOMMENDED_RESUPPLY FROM INVENTORY JOIN SOLD ON INVENTORY.NAME = SOLD.NAME WHERE INVENTORY.QUANTITY < SOLD.AMOUNT`
    
    pool.query(queryThing, (err, res) => {
        if(err) {
            response.json({err: err})
            return
        }
        response.json({rows: res.rows})
    })
})

app.get('/sellsTogetherReport', (req, response) => {
    let queryThing = `WITH PAIRS AS ( SELECT ITEM.ID AS THIS, I2.ID AS OTHER FROM ITEM JOIN ITEM I2 ON ITEM.ID < I2.ID ), MATCHES AS ( SELECT * FROM BRIDGE JOIN PAIRS ON BRIDGE.ITEM_ID = PAIRS.THIS JOIN ORDERS ON BRIDGE.ORDER_ID = ORDERS.ID JOIN TICKET ON ORDERS.TICKET_ID = TICKET.ID WHERE PAIRS.OTHER IN (SELECT ITEM_ID FROM BRIDGE B WHERE B.ORDER_ID = BRIDGE.ORDER_ID) AND TICKET.ORDER_TIME BETWEEN (TIMESTAMP '${req.query.start}' AT TIME ZONE 'UTC' AT TIME ZONE 'CST') AND (TIMESTAMP '${req.query.end}' AT TIME ZONE 'UTC' AT TIME ZONE 'CST') ) SELECT ITEM1.NAME AS THIS_NAME, ITEM2.NAME AS OTHER_NAME, COUNT(ORDER_ID) FROM MATCHES JOIN ITEM ITEM1 ON THIS = ITEM1.ID JOIN ITEM ITEM2 ON OTHER = ITEM2.ID GROUP BY ITEM1.NAME, ITEM2.NAME ORDER BY COUNT(ORDER_ID) DESC`
    
    pool.query(queryThing, (err, res) => {
        if(err) {
            response.json({err: err})
            return
        }
        response.json({rows: res.rows})
    })
})

app.get('/items', (req, response) => {
    pool.query(`SELECT * FROM ITEM WHERE CATEGORY = 'Entree' OR CATEGORY = 'Side'`, (err, res) => {
        if(err) {
            response.json({err: err})
            return
        }
        response.json({rows: res.rows})
    })
    .catch((err) => {
      console.log(err);
    });

  response.json({ err: false });
});

app.get("/excessReport", (req, response) => {
  let queryThing = `WITH SOLD AS (SELECT INVENTORY.NAME AS NAME, SUM(BRIDGE.AMOUNT * ITEM_INGREDIENTS.AMOUNT) AS AMOUNT FROM TICKET JOIN ORDERS ON ORDERS.TICKET_ID = TICKET.ID JOIN BRIDGE ON ORDERS.ID = BRIDGE.ORDER_ID JOIN ITEM ON BRIDGE.ITEM_ID = ITEM.ID JOIN ITEM_INGREDIENTS ON ITEM_INGREDIENTS.ITEM_ID = ITEM.ID JOIN INVENTORY ON ITEM_INGREDIENTS.INVENTORY_ID = INVENTORY.INGREDIENT_ID WHERE ORDER_TIME > (TIMESTAMP '${req.query.start}' AT TIME ZONE 'UTC' AT TIMEZONE 'CST') GROUP BY INVENTORY.NAME) SELECT ITEM.NAME AS ITEM_NAME, INVENTORY.NAME AS INGREDIENT_NAME, SOLD.AMOUNT / (SOLD.AMOUNT + INVENTORY.QUANTITY * 1.0) AS PERCENT_SOLD, SOLD.AMOUNT AS AMOUNT_SOLD, INVENTORY.QUANTITY + SOLD.AMOUNT AS TOTAL_QUANTITY FROM INVENTORY JOIN SOLD ON INVENTORY.NAME = SOLD.NAME JOIN ITEM_INGREDIENTS ON INVENTORY.INGREDIENT_ID = ITEM_INGREDIENTS.INVENTORY_ID JOIN ITEM ON ITEM_INGREDIENTS.ITEM_ID = ITEM.ID WHERE SOLD.AMOUNT / (SOLD.AMOUNT + INVENTORY.QUANTITY * 1.0) < 0.1`;

  pool.query(queryThing, (err, res) => {
    if (err) {
      response.json({ err: err });
      return;
    }
    response.json({ rows: res.rows });
  });
});

app.get("/restockReport", (req, response) => {
  let queryThing = `WITH SOLD AS (SELECT INVENTORY.NAME AS NAME,SUM(BRIDGE.AMOUNT * ITEM_INGREDIENTS.AMOUNT) AS AMOUNT FROM TICKET JOIN ORDERS ON ORDERS.TICKET_ID = TICKET.ID JOIN BRIDGE ON ORDERS.ID = BRIDGE.ORDER_ID JOIN ITEM ON BRIDGE.ITEM_ID = ITEM.ID JOIN ITEM_INGREDIENTS ON ITEM_INGREDIENTS.ITEM_ID = ITEM.ID JOIN INVENTORY ON ITEM_INGREDIENTS.INVENTORY_ID = INVENTORY.INGREDIENT_ID WHERE ORDER_TIME > NOW() AT TIME ZONE 'US/Central'  - INTERVAL '7 DAYS' GROUP BY INVENTORY.NAME) SELECT INVENTORY.NAME, INVENTORY.QUANTITY AS CURRENT_AMOUNT, SOLD.AMOUNT AS LAST_7_DAYS_SALES, ROUND(SOLD.AMOUNT * 1.1 - INVENTORY.QUANTITY) AS RECOMMENDED_RESUPPLY FROM INVENTORY JOIN SOLD ON INVENTORY.NAME = SOLD.NAME WHERE INVENTORY.QUANTITY < SOLD.AMOUNT`;

  pool.query(queryThing, (err, res) => {
    if (err) {
      response.json({ err: err });
      return;
    }
    response.json({ rows: res.rows });
  });
});

app.get("/sellsTogetherReport", (req, response) => {
  let queryThing = `WITH PAIRS AS ( SELECT ITEM.ID AS THIS, I2.ID AS OTHER FROM ITEM JOIN ITEM I2 ON ITEM.ID < I2.ID ), MATCHES AS ( SELECT * FROM BRIDGE JOIN PAIRS ON BRIDGE.ITEM_ID = PAIRS.THIS JOIN ORDERS ON BRIDGE.ORDER_ID = ORDERS.ID JOIN TICKET ON ORDERS.TICKET_ID = TICKET.ID WHERE PAIRS.OTHER IN (SELECT ITEM_ID FROM BRIDGE B WHERE B.ORDER_ID = BRIDGE.ORDER_ID) AND TICKET.ORDER_TIME BETWEEN (TIMESTAMP '${req.query.start}' AT TIME ZONE 'UTC' AT TIME ZONE 'CST') AND (TIMESTAMP '${req.query.end}' AT TIME ZONE 'UTC' AT TIME ZONE 'CST') ) SELECT ITEM1.NAME AS THIS_NAME, ITEM2.NAME AS OTHER_NAME, COUNT(ORDER_ID) FROM MATCHES JOIN ITEM ITEM1 ON THIS = ITEM1.ID JOIN ITEM ITEM2 ON OTHER = ITEM2.ID GROUP BY ITEM1.NAME, ITEM2.NAME ORDER BY COUNT(ORDER_ID) DESC`;

  pool.query(queryThing, (err, res) => {
    if (err) {
      response.json({ err: err });
      return;
    }
    response.json({ rows: res.rows });
  });
});

app.get("/items", (req, response) => {
  pool.query(
    `SELECT * FROM ITEM WHERE CATEGORY = 'Entree' OR CATEGORY = 'Side'`,
    (err, res) => {
      if (err) {
        response.json({ err: err });
        return;
      }
      response.json({ rows: res.rows });
    }
  );
});

// Get the item id for a given menu item
app.get("/getMenuID", (req, response) => {
  let name = req.query.name;

  //console.log("Requesting ID for: ", name);
  pool.query(`SELECT ID FROM ITEM WHERE NAME=$1`, [name], 

    (err, res) => {
      if (err) {
        console.log(err);
        response.json({ err: err });
        return;
      }
      console.log(res);
      response.json({ rows: res.rows });
    })
})

// Add a menu item to the database
app.get("/addMenuItem", (req, response) => {
  let queryThing = `INSERT INTO ITEM(NAME, CATEGORY, EXTRA_PRICE) VALUES ('${req.query.name}', '${req.query.category}', ${req.query.price})`;

  //console.log(queryThing);


  pool.query(queryThing, (err, res) => {
    if (err) {
      console.log(err);
      response.json({err: err});
      return;
    }
    //response.json({ res: res.rows });

    let ingreds = req.query.ingredients;

    // console.log("Menu name: ", req.query.name);
    // console.log("Menu category: ", req.query.category);
    // console.log("Menu price: ", req.query.price);
    // console.log("Menu ingredients: ", req.query.ingredients);

    let ingredientCount = 0;


    ingreds.forEach((ingredient) => {
      let ingredientMapping = `INSERT INTO ITEM_INGREDIENTS(ITEM_ID, INVENTORY_ID, AMOUNT) VALUES ((SELECT ID FROM ITEM WHERE NAME = '${req.query.name}'), (SELECT INGREDIENT_ID FROM INVENTORY WHERE NAME = '${ingredient.name}'), ${ingredient.amount})`

      pool.query(ingredientMapping, (err2, res2) => {
        if (err2) {
          console.log(err2);
          response.json({err: err2});
          return;
        }

        ingredientCount++;

        if (ingredientCount === ingreds.length) {
          response.json({ res: res2.rows });
        }

        //response.json({ res: res2.rows });
      })
    });
  }

  )

})

app.get("/deleteMenuItem", (req, response) => {
  let removeConnections = `DELETE FROM ITEM_INGREDIENTS WHERE ITEM_ID = ${req.query.id}`;

  pool.query(removeConnections, (err, res) => {
    if (err) {
      console.log(err);
      response.json({ err: err });
      return;
    }
    //console.log("Deleted all ingredient connections");

    let deleteMenuItem = `DELETE FROM ITEM WHERE ID = ${req.query.id}`

    pool.query(deleteMenuItem, (err2, res2) => {
      if (err2) {
        console.log(err2);
        response.json({ err: err2 });
        return;
      }

      //console.log("Deleted menu item");
      response.json({ rows: res.rows });
    })
  })
})

app.get('/people', (req, response) => {
  let query = `SELECT FIRST_NAME || ' ' || LAST_NAME AS NAME,
                  EMAIL,
                  PERMISSION
                FROM USERS`
  pool.query(query, (err, res) => {
    if(err) {
      console.log(err)
      response.json({err: err})
      return
    }
    response.json({rows: res.rows})
  })
})

app.get('/change-perm', (req, response) => {
  let perm = req.query.perm
  let email = req.query.email
  let query = `UPDATE USERS SET PERMISSION = $1 WHERE EMAIL = $2`
  pool.query(query, [perm, email], (err, res) => {
    if(err) {
      console.log(err)
      response.json({err: err})
      return
    }
    response.json({err: false})
  })
})