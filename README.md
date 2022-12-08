# Team-15-Project_3


# Getting Started
- Clone repository
- Open terminal and run `cd backend`, and `npm install`, and `npm start`
- Open new terminal and run `cd frontend` and `npm install`, and `npm start`
- Happy Coding!

# Backend
Backend currently uses node.js and express.js
You need a `.env` file with secret keys for **Google Translate** and the **SQL Database** URL

# Frontend
Frontend currently uses React.js 
There are several components and **routes** that website currently runs in 

## Manager
Found in `frontend/src/pages/manager/Manager.js`
[`Manager`](./OtherPages/Manager.md) displays 4 tabs with a list of tables
  - [`Inventory`](./OtherPages/Inventory.md)
  - [`MyMenu`](./OtherPages/MyMenu.md)
  - [`Reports`](./OtherPages/Reports.md)
  - [`Access`](./OtherPages/Access.md)

There are also some components that are used for user input
  - [`InventoryDialog`](./OtherPages/InventoryDialog.md)
  - [`MyMenuDialog`](./OtherPages/MyMenuDialog.md)
  
## Customer
Found in `frontend/src/pages/customer/Customer.js`
`Customer.js` displays 2 views
  - [`OrderView`](./OtherPages/OrderView.md)
  - [`PlateView`](./OtherPages/PlateView.md)

## Cashier 
Found in `frontend/src/pages/cashier/Cashier.js`
`Cashier.js` displays 2 views
  - [`OrderView`](./OtherPages/OrderView.md)
  - [`PlateView`](./OtherPages/PlateView.md)
