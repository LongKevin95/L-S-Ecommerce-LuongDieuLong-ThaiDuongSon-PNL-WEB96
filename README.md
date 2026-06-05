# L&S Ecommerce Backend Skeleton

Backend skeleton cho Express + MongoDB + MVC, được dựng để bám theo contract đã chốt ở frontend và phù hợp để deploy trên Render.

## Stack

- Node.js
- Express
- MongoDB + Mongoose
- JWT
- bcryptjs

## Scripts

```bash
npm install
npm run dev
npm start
```

## Seed demo data

```bash
npm run seed
```

Seed script sẽ tạo hoặc cập nhật các tài khoản demo sau:

- `customer@ls.com / 123456`
- `vendor@ls.com / 123456`
- `admin@ls.com / 123456`

## Postman collection

Collection file nằm tại:

- `docs/postman/ls-ecommerce-backend.postman_collection.json`

Thứ tự test nhanh được đề xuất:

1. `GET /health`
2. Chạy 3 request login để Postman tự lưu `customerToken`, `vendorToken`, `adminToken`
3. `GET /products` để Postman tự lưu `productId`
4. `POST /orders` để tạo order demo và lưu `orderId`
5. Test các luồng vendor/admin còn lại

## Environment variables

Copy `.env.example` thành `.env` và cập nhật:

```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/ls-ecommerce
JWT_SECRET=change-this-secret
CLIENT_URL=http://localhost:5173,https://your-frontend.onrender.com
```

Nếu dùng MongoDB Atlas, `MONGODB_URI` có thể ở dạng:

```env
MONGODB_URI=mongodb+srv://your_db_user:your_db_password@cluster0.xxxxx.mongodb.net/final-project-ls-ecommerce?retryWrites=true&w=majority&appName=Cluster0
```

Bạn không cần tạo collection thủ công trước. Sau khi `MONGODB_URI` đúng và chạy `npm run seed`, Mongoose sẽ tự tạo các collection chính như `users`, `products`, và `orders`.

## Cấu trúc chính

- `src/app.js`: app Express và middleware chung
- `src/server.js`: bootstrap server
- `src/config/*`: env và database
- `src/routes/*`: route definitions
- `src/controllers/*`: controller layer
- `src/models/*`: mongoose models
- `src/middlewares/*`: auth, error, not found
- `src/utils/*`: helper dùng chung

## Render deployment notes

### Backend service

- Type: Web Service
- Root Directory: folder backend này
- Build Command: `npm install`
- Start Command: `npm start`

### Required env vars on Render

- `NODE_ENV=production`
- `PORT=10000`
- `MONGODB_URI=<your-mongodb-atlas-uri>`
- `JWT_SECRET=<strong-secret>`
- `CLIENT_URL=<your-frontend-render-url>`

## Trạng thái hiện tại

Business logic chính theo contract đã được implement cho auth, users, products, orders, vendor, và admin flows. Bạn chỉ cần cài package, cấu hình MongoDB, seed dữ liệu demo nếu muốn, rồi chạy server.
