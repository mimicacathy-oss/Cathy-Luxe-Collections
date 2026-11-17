# Cathy Luxe Collections — Perfume Shop Management System

A complete business management system for a perfume retail shop. The application tracks inventory (perfumes), customer information, sales orders, and provides a dashboard with sales analytics and stock management alerts.

## System Overview

Cathy Luxe Collections is a full-stack web application designed for small business owners in the perfume retail industry. The system enables staff to:

- Manage product inventory with images, pricing, stock levels, and scent descriptions
- Maintain customer records with contact details and purchase preferences
- Record sales transactions with automatic stock deduction
- View business performance through a dashboard with sales charts and low-stock alerts
- Share order receipts via WhatsApp for customer convenience

The application is designed to work **offline** for core functionality — all CSS, JavaScript, fonts, and product images are served locally, making it suitable for environments with unreliable internet connectivity.

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Database** | MongoDB (local or MongoDB Atlas) |
| **Backend** | Node.js, Express.js (CommonJS), Mongoose ODM |
| **Authentication** | JSON Web Tokens (JWT) with bcryptjs password hashing |
| **File Uploads** | Multer for local image storage |
| **Frontend** | HTML5, CSS3, Bootstrap 5.3 (local), Bootstrap Icons (local), Chart.js (local), vanilla JavaScript |
| **Development** | nodemon (auto-restart during development) |

**Note:** The application does not use React, Vue, jQuery, TypeScript, Tailwind, or any build tools. All frontend code is served directly by Express as static files.

## System Architecture

```
Perfume_Management/
├── server.js                 # Application entry point — connects DB, mounts routes, serves static files
├── config/
│   └── db.js                 # MongoDB connection configuration
├── models/                   # Mongoose schemas
│   ├── User.js               # Staff account model (email, password hash)
│   ├── Product.js            # Perfume model (name, brand, category, price, stock, image)
│   ├── Customer.js           # Customer model (name, phone, email, preferences)
│   └── Order.js              # Order model (customer, items, total, status)
├── middleware/
│   ├── authMiddleware.js     # JWT verification for protected routes
│   └── errorHandler.js       # Centralized error handling
├── routes/                   # API endpoints
│   ├── authRoutes.js         # POST /login
│   ├── productRoutes.js     # CRUD for products with image upload
│   ├── customerRoutes.js     # CRUD for customers
│   ├── orderRoutes.js        # CRUD for orders with stock management
│   └── dashboardRoutes.js    # GET /summary for analytics
├── seed/
│   └── seed.js               # Database seeding script
├── public/                   # Static frontend files
│   ├── login.html            # Staff authentication page
│   ├── index.html            # Dashboard with charts and low-stock table
│   ├── products.html         # Product management page
│   ├── customers.html        # Customer management page
│   ├── orders.html           # Order management with receipt printing
│   ├── catalogue.html        # Public catalogue (no login required)
│   ├── css/
│   │   └── style.css         # Custom luxury theme styling
│   ├── js/
│   │   ├── api.js            # Fetch wrapper with JWT handling
│   │   ├── auth.js           # Login/logout/session management
│   │   ├── ui.js             # UI utilities (toasts, modals, placeholders)
│   │   ├── dashboard.js      # Dashboard logic and charts
│   │   ├── products.js       # Product CRUD operations
│   │   ├── customers.js      # Customer CRUD operations
│   │   ├── orders.js         # Order management and receipt generation
│   │   └── catalogue.js      # Public catalogue logic
│   ├── vendor/               # Local copies of third-party libraries (offline support)
│   │   ├── bootstrap.min.css
│   │   ├── bootstrap.bundle.min.js
│   │   ├── bootstrap-icons.min.css
│   │   ├── fonts/            # Bootstrap Icons font files
│   │   ├── fonts.css         # Google Fonts (Playfair Display, Poppins)
│   │   ├── fonts/            # Google Font WOFF2 files
│   │   └── chart.umd.min.js
│   └── uploads/              # User-uploaded product images
├── package.json              # Project dependencies and scripts
├── .env.example              # Environment variables template
├── .gitignore                # Git ignore rules
└── README.md                 # This file
```

## Key Features

### Authentication
- Staff login with email and password
- JWT-based session management (8-hour token expiry)
- Automatic redirect to login page on session expiry
- Passwords stored as bcrypt hashes (never in plain text)

### Dashboard
- **Sales Metrics:** Today's sales, this month's sales, total completed orders
- **Inventory Counts:** Total products, total customers, low-stock items
- **Visualizations:** 7-day sales line chart, top 5 best-sellers doughnut chart
- **Low-Stock Alerts:** Configurable threshold with one-click restock button

### Product Management
- Add, edit, and delete perfumes
- Local image upload support (max 5MB, accepts JPEG, PNG, GIF, WebP)
- Categories: Men, Women, Unisex, Oud, Fresh, Floral
- Search by name or brand
- Filter by category and price range
- Pagination for large inventories
- Delete protection for products referenced in completed orders

### Customer Management
- Add, edit, and delete customers
- Unique phone number validation
- Optional email and preference notes
- Search by name or phone
- Delete protection for customers with order history

### Order Management
- Create orders with multiple product lines
- Live running total calculation
- Automatic stock deduction on order creation
- Stock restoration on order cancellation or deletion
- Print receipt functionality
- WhatsApp share integration
- Edit orders with automatic stock adjustment
- Filter by status (Completed/Cancelled) and date range

### Public Catalogue
- No login required
- Displays only in-stock products
- "Order on WhatsApp" button for each product
- Same search and filter capabilities as staff view

### Offline Capability
- All CSS, JavaScript, and fonts served locally
- Product images stored locally
- Application styling remains functional without internet
- Only external dependencies are WhatsApp links and MongoDB Atlas (if used)

## Stock Management Logic

The system implements careful stock handling without database transactions:

1. **Order Creation:** When an order is created, the system checks stock availability for each item. If any item has insufficient stock, the entire order is rejected and no stock is deducted. If all items have sufficient stock, stock is deducted atomically per item.

2. **Order Editing:** When editing an order, the system first restores stock for the original items, then attempts to deduct stock for the new items. If the new items cannot be fulfilled (insufficient stock), the original stock is restored exactly as it was, leaving the order unchanged.

3. **Order Cancellation:** Cancelling an order marks it as "Cancelled" and restores all stock to inventory.

4. **Order Deletion:** Deleting a completed order restores stock to inventory. Deleting a cancelled order does not modify stock (already restored).

This ensures that stock never becomes inconsistent, even if operations fail mid-process.

## Installation and Setup

### Quick Setup Options

For the fastest setup on any machine, choose one of the following options:

#### Option 1: Docker (Recommended - Cross-Platform)

Docker provides a complete, isolated environment with both the application and MongoDB. This is the easiest way to run the app on any machine.

**Prerequisites:**
- Docker Desktop installed on your machine

**Steps:**

1. Clone or download this project
2. Navigate to the project directory
3. Run the following command:

```bash
docker-compose up -d
```

This will:
- Build the application container
- Start MongoDB in a separate container
- Configure networking between the containers
- Persist MongoDB data in a Docker volume

4. Seed the database (run once):

```bash
docker-compose exec app npm run seed
```

5. Access the application at <http://localhost:3000>

**Useful Docker Commands:**
- `docker-compose up -d` — Start all services in background
- `docker-compose down` — Stop all services
- `docker-compose logs -f` — View logs
- `docker-compose exec app npm run seed` — Seed the database
- `docker-compose exec app npm run dev` — Run in development mode

#### Option 2: Automated Setup Script

Use the provided setup script for your operating system:

**Windows (PowerShell):**

```powershell
.\setup.ps1
```

**Linux/Mac (Bash):**

```bash
chmod +x setup.sh
./setup.sh
```

The script will:
- Check for Node.js and npm installation
- Install all project dependencies
- Create `.env` file with a random JWT secret
- Prompt to seed the database with sample data

**Note:** You must still have MongoDB installed and running before running the setup script.

---

### Manual Setup

If you prefer to set up manually, follow the steps below.

### Prerequisites

- **Node.js** (LTS version 18 or newer)
- **MongoDB** (local installation or MongoDB Atlas account)

### Step 1: Install Node.js (Manual Setup)

1. Download from <https://nodejs.org>
2. Install with default options (ensure "Add to PATH" is checked on Windows)
3. Verify installation:

```powershell
node -v
npm -v
```

### Step 2: Set Up MongoDB (Manual Setup)

Choose one of the following options:

#### Option A: Local MongoDB (Recommended for offline use)

1. Download MongoDB Community Server from <https://www.mongodb.com/try/download/community>
2. Install with default settings
3. On Windows, ensure MongoDB service is running:

```powershell
Get-Service -Name MongoDB
```

If stopped, start it as Administrator:

```powershell
Start-Service -Name MongoDB
```

#### Option B: MongoDB Atlas (Cloud)

1. Create a free account at <https://www.mongodb.com/atlas>
2. Create a free M0 cluster
3. Create a database user with username and password
4. Add your IP address to Network Access (or allow `0.0.0.0/0` for testing)
5. Copy the connection string and add `/perfume_shop` before the `?`:
   ```
   mongodb+srv://user:password@cluster0.abcde.mongodb.net/perfume_shop?retryWrites=true&w=majority
   ```

#### Option C: Campus MongoDB Server

If your campus provides a shared MongoDB server:

1. Obtain the following information from your campus IT department:
   - **Server hostname or IP address** (e.g., `mongodb.campus.edu` or `192.168.1.100`)
   - **Port number** (default is `27017`)
   - **Database name** (e.g., `perfume_shop` or a campus-assigned name)
   - **Username and password** (if authentication is required)

2. Configure the connection string in your `.env` file:

   **Without authentication:**
   ```
   MONGO_URI=mongodb://hostname:port/database_name
   # Example: mongodb://mongodb.campus.edu:27017/perfume_shop
   ```

   **With authentication:**
   ```
   MONGO_URI=mongodb://username:password@hostname:port/database_name
   # Example: mongodb://student:pass123@mongodb.campus.edu:27017/perfume_shop
   ```

3. **Campus Network Considerations:**
   - Ensure your device is connected to the campus network (wired or Wi-Fi)
   - If connecting from off-campus, you may need to use the campus VPN
   - Check if the campus firewall allows outbound connections on the MongoDB port (27017)
   - If the MongoDB server is behind a firewall, request IT to whitelist your device's IP address

4. **Test the connection:**
   - Start the server with `npm start`
   - If the connection fails, check:
     - Your network connectivity to the campus server
     - Firewall settings on your device
     - Whether the MongoDB service is running on the campus server
     - Correct username/password if authentication is enabled

### Step 3: Install Project Dependencies (Manual Setup)

Navigate to the project directory and install packages:

```powershell
cd C:\Users\HP\Desktop\Perfume_Management
npm install
```

### Step 4: Configure Environment Variables (Manual Setup)

Copy the example environment file:

```powershell
copy .env.example .env
```

Edit `.env` with your configuration:

```
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/perfume_shop
JWT_SECRET=your_long_random_secret_string_here
LOW_STOCK_LEVEL=5
```

- `PORT`: Server port (default 3000)
- `MONGO_URI`: MongoDB connection string (use local default or Atlas string)
- `JWT_SECRET`: Secret key for JWT signing (use a strong random string)
- `LOW_STOCK_LEVEL`: Stock threshold for low-stock alerts

### Step 5: Seed the Database (Manual Setup)

Create initial data (admin account, sample products, sample customers):

```powershell
npm run seed
```

This can be run again to reset the database to a clean state.

### Step 6: Start the Server (Manual Setup)

```powershell
npm start        # Production start
npm run dev      # Development start with auto-restart
```

The application will be available at <http://localhost:3000>

## Default Credentials

After seeding, use these credentials to log in:

| Email | Password |
|-------|----------|
| `admin@perfume.com` | `admin123` |

The public catalogue is accessible without login at <http://localhost:3000/catalogue.html>

## API Endpoints

### Authentication
- `POST /api/auth/login` — Authenticate and receive JWT

### Products
- `GET /api/products` — List all products (staff only)
- `GET /api/products/public` — List in-stock products (public)
- `GET /api/products/:id` — Get single product (staff only)
- `POST /api/products` — Create product with optional image upload (staff only)
- `PUT /api/products/:id` — Update product with optional image upload (staff only)
- `DELETE /api/products/:id` — Delete product (staff only, protected if in completed orders)

### Customers
- `GET /api/customers` — List customers (staff only)
- `GET /api/customers/:id` — Get single customer (staff only)
- `POST /api/customers` — Create customer (staff only)
- `PUT /api/customers/:id` — Update customer (staff only)
- `DELETE /api/customers/:id` — Delete customer (staff only, protected if has orders)

### Orders
- `GET /api/orders` — List orders with filters (staff only)
- `GET /api/orders/:id` — Get single order (staff only)
- `POST /api/orders` — Create order (staff only)
- `PUT /api/orders/:id` — Update order (staff only)
- `PATCH /api/orders/:id/cancel` — Cancel order and restore stock (staff only)
- `DELETE /api/orders/:id` — Delete order and restore stock if completed (staff only)

### Dashboard
- `GET /api/dashboard/summary` — Get sales metrics, low stock, best sellers, chart data (staff only)

## Security Considerations

- Passwords are hashed using bcryptjs before storage
- JWT tokens expire after 8 hours
- All API routes (except login and public catalogue) require valid JWT
- File uploads are restricted to image types (JPEG, PNG, GIF, WebP) with 5MB size limit
- Environment variables containing secrets are excluded from version control
- Input validation is enforced at both frontend and backend levels

## Offline Usage

The application is designed to function offline for core operations:

- All CSS, JavaScript, fonts, and icons are served from `public/vendor/`
- Product images are stored locally in `public/uploads/`
- The only features requiring internet are:
  - WhatsApp sharing (external link to wa.me)
  - MongoDB Atlas (if cloud database is used instead of local MongoDB)

For full offline capability, use a local MongoDB installation.

## Development

### Project Scripts

- `npm start` — Start the production server
- `npm run dev` — Start with nodemon for auto-restart during development
- `npm run seed` — Seed the database with sample data

### Adding New Features

The codebase follows a clear separation of concerns:

- **Models** (`models/`) — Define data schemas and validation rules
- **Routes** (`routes/`) — Implement API endpoints with business logic
- **Middleware** (`middleware/`) — Implement cross-cutting concerns (auth, error handling)
- **Frontend** (`public/js/`) — Page-specific JavaScript modules
- **Styles** (`public/css/`) — Custom styling on top of Bootstrap

## License

MIT License
