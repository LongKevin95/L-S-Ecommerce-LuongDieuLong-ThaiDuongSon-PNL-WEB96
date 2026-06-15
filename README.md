# L&S Ecommerce Backend

Express + MongoDB backend for the L&S Ecommerce project.

This backend powers authentication, products, shops, orders, wishlist,
vendor/admin management, and post-purchase product reviews.

## Tech Stack

- Node.js
- Express
- MongoDB + Mongoose
- JWT
- bcryptjs
- Multer
- Cloudinary

## Main Features

- Auth: signup, login, profile update
- Public products and product detail
- Shops and vendor storefront data
- Customer orders and cancellation flow
- Vendor product CRUD and order handling
- Admin product moderation and account management
- Wishlist endpoints
- Product reviews after completed purchase
- Vendor replies to customer reviews

## API Modules

- `/health`
- `/auth`
- `/users`
- `/products`
- `/shops`
- `/orders`
- `/wishlist`
- `/payments`
- `/vendor`
- `/admin`

## Local Development

```bash
npm install
npm run dev
```

Production-style start:

```bash
npm start
```

## Environment

Copy `.env.example` to `.env` and fill in your values:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb+srv://your_db_user:your_db_password@cluster0.xxxxx.mongodb.net/final-project-ls-ecommerce?appName=Cluster0
JWT_SECRET=change-this-secret
CLIENT_URL=http://localhost:5173,https://your-frontend.onrender.com
```

Notes:

- `CLIENT_URL` supports a comma-separated list of allowed origins.
- In development, localhost origins on different ports are also allowed for
  easier FE/BE testing.

## MongoDB Notes

- MongoDB Atlas works with the connection string in `MONGODB_URI`.
- Local MongoDB also works, for example:

```env
MONGODB_URI=mongodb://127.0.0.1:27017/final-project-ls-ecommerce
```

- The startup flow now fails fast and logs clearer diagnostics when MongoDB
  DNS resolution or server selection fails.
- Common failure hints are printed for:
  - Atlas DNS resolution issues
  - wrong username/password
  - IP allowlist / network access problems
  - server timeout / connection refusal

## Seed Demo Data

```bash
npm run seed
```

The seed script creates or updates these demo accounts:

- `customer@ls.com / 123456`
- `vendor@ls.com / 123456`
- `admin@ls.com / 123456`

## Render Deployment

Recommended Render service settings:

- Type: Web Service
- Root Directory: this backend folder
- Build Command: `npm install`
- Start Command: `npm start`

Required env vars on Render:

- `NODE_ENV=production`
- `PORT=10000`
- `MONGODB_URI=<your-atlas-uri>`
- `JWT_SECRET=<strong-secret>`
- `CLIENT_URL=<your-frontend-url>`

## Project Structure

- `src/app.js`: Express app and middleware
- `src/server.js`: bootstrap and startup error handling
- `src/config/*`: env and database config
- `src/routes/*`: route registration
- `src/controllers/*`: controller logic
- `src/models/*`: Mongoose models
- `src/middlewares/*`: auth and error middleware
- `src/utils/*`: shared helpers
- `src/scripts/seedDemoData.js`: demo data seeding

## Tested Integration

This backend was smoke-tested with the frontend for:

- signup and login
- product list and product detail
- cart and checkout order creation
- vendor product create/update/delete
- admin product approval
- customer order tracking
- customer review after completed purchase
- vendor reply to review
