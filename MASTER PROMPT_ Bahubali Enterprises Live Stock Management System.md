# MASTER PROMPT: Bahubali Enterprises Live Stock Management System

Build a production-ready, fast, mobile-first **Stock & Inventory Management Web App for “Bahubali Enterprises”**, a hardware all-in-one shop.

The primary problem this app must solve is:

> **A huge amount of daily work gets wasted because staff do not know the exact current stock, product details, or which brand/item they are looking at.**

The app should make it extremely easy for someone standing inside the shop to open the app on their phone, search a product, **see its photo and brand**, and immediately know how much stock is available.

---

## 1. CORE REQUIREMENTS

Build this as a **mobile-first responsive web application / PWA**.

It must work extremely well on:

- Mobile phones
- Tablets
- Desktop/laptop

Mobile usage is the priority.

The application must feel:

- Fast
- Simple
- Clean
- Practical
- Easy for non-technical shop staff
- Minimal clicks
- No unnecessary animations
- No bloated UI
- No complicated navigation

### Most important requirement

**REAL-TIME DATA SYNCHRONIZATION**

If one user adds, edits, deletes, or changes stock:

> Every other currently open device should see the updated information immediately without manually refreshing the page.

Example:

Staff A on Phone 1:

`PVC Pipe → Stock: 25 → 20`

Immediately:

Staff B on Phone 2:

`PVC Pipe → Stock: 20`

The database must be the single source of truth.

---

# 2. TECH STACK

Use a modern production-ready stack.

Preferred:

- Frontend: React / Next.js
- TypeScript
- Tailwind CSS
- Supabase for database, authentication, real-time subscriptions and image storage

Use Supabase:

- PostgreSQL database
- Supabase Auth
- Supabase Storage
- Supabase Realtime

If Antigravity has a better equivalent stack available, you may use it, but preserve all functionality.

Do NOT create a fake/local-only application.

The data must persist permanently in the database.

---

# 3. PRODUCT DATABASE

Every product should have the following fields:

### Basic Information

- Product ID
- Product Name
- Product Photo
- Brand
- Category
- Sub-category
- Product/SKU Code
- Description

### Stock Information

- Current Stock
- Unit
  - Piece
  - Box
  - Packet
  - Kg
  - Meter
  - Coil
  - Set
  - Pair
  - etc.
- Minimum Stock Level
- Reorder Level
- Maximum Stock Level

### Commercial Information

- Purchase Price
- Selling Price
- Supplier
- Last Purchase Date

### Location

- Rack
- Shelf
- Store/Section
- Optional location notes

### Metadata

- Created At
- Updated At
- Created By
- Last Updated By
- Active/Inactive status

---

# 4. PRODUCT IMAGE SYSTEM - VERY IMPORTANT

Every product should have a prominent **Product Image**.

The purpose is not decoration.

The image should help staff identify the product and understand:

> “Which exact item/brand is this?”

For example:

**Product Name:** 8mm Drill Bit  
**Brand:** Bosch

[PRODUCT PHOTO]

Staff should be able to visually recognize the item from the photo.

### Image upload requirements

When adding/editing a product:

- Allow image upload directly from mobile camera
- Allow selecting image from phone gallery
- Allow drag-and-drop on desktop
- Show image preview before saving
- Allow replacing the image
- Allow deleting/re-uploading image
- Automatically compress/optimize large images
- Maintain good visual quality
- Store images in cloud storage
- Store the image URL/reference in the product database

On mobile, provide:

**📷 Take Photo**

and

**🖼️ Choose from Gallery**

The product image should appear in:

- Product list
- Search results
- Product detail page
- Stock In screen
- Stock Out screen
- Dashboard where relevant
- Low-stock list
- Recent activity where relevant

Use thumbnails in lists for speed.

Use a larger image on the product detail page.

---

# 5. PRODUCT IDENTIFICATION

Search must be extremely powerful and fast.

Users should be able to search by:

- Product name
- Brand
- SKU
- Product code
- Category
- Sub-category
- Supplier
- Rack/location

Example:

Searching:

`Bosch`

should show all Bosch products.

Searching:

`8mm`

should show relevant 8mm products.

Searching:

`drill`

should show all drill-related products.

Search results should show:

**[IMAGE] Bosch 8mm Drill Bit**

Stock: 14 pcs  
Rack: B-12

The image should make identification instant.

---

# 6. DASHBOARD

Create a simple, highly useful dashboard.

Top:

**Bahubali Enterprises**

### Overview cards

- Total Products
- Total Stock Items
- Low Stock
- Out of Stock
- Stock Added Today
- Stock Removed Today

### Quick Actions

Large mobile-friendly buttons:

**+ STOCK IN**

**− STOCK OUT**

**ADD PRODUCT**

**SEARCH STOCK**

### Low Stock Section

Show products where:

`Current Stock <= Minimum Stock Level`

Display:

[IMAGE]

Product Name  
Brand  
Current Stock  
Minimum Stock  
Rack

Example:

**Bosch 8mm Drill Bit**

Stock: 2 pcs  
Minimum: 5 pcs  
⚠️ Low Stock  
Rack: B-12

---

# 7. STOCK IN

Create a very fast Stock In workflow.

User clicks:

**+ Stock In**

Then:

1. Search/select product
2. Product image appears
3. Product name + brand appears
4. Current stock appears
5. Enter quantity
6. Optional supplier
7. Optional purchase price
8. Optional invoice/reference
9. Save

Example:

**Bosch 8mm Drill Bit**

[IMAGE]

Current Stock: 14 pcs

Quantity Added:

`+ 20`

New Stock:

`34 pcs`

Click:

**CONFIRM STOCK IN**

Immediately update the database.

Immediately update all connected devices.

---

# 8. STOCK OUT

Create an equally fast Stock Out workflow.

User clicks:

**− Stock Out**

Then:

1. Search product
2. Product image appears
3. Product name + brand appears
4. Current stock appears
5. Enter quantity
6. Optional reason/customer/reference
7. Confirm

Example:

Current Stock:

`34 pcs`

Stock Out:

`5 pcs`

New Stock:

`29 pcs`

Do NOT allow stock to become negative.

Show a clear warning if someone tries to remove more stock than available.

---

# 9. STOCK MOVEMENT HISTORY

Every stock change must create a transaction record.

Store:

- Transaction ID
- Product ID
- Type: IN / OUT / ADJUSTMENT
- Quantity
- Previous Stock
- New Stock
- User
- Date/time
- Reason
- Reference/invoice if applicable

Create a:

**Stock History**

page.

Allow filtering by:

- Product
- Brand
- Category
- User
- IN/OUT
- Date range

Example:

`10 Aug 2026`

Raj  
+20 Bosch Drill Bits  
Stock: 14 → 34

Amit  
-5 Bosch Drill Bits  
Stock: 34 → 29

---

# 10. MANUAL STOCK ADJUSTMENT

Admin should have an:

**Adjust Stock**

option.

For example:

Database says:

`50 pcs`

Physical count:

`47 pcs`

Admin can adjust:

`50 → 47`

Mandatory reason:

`Physical stock verification`

Every adjustment must be recorded in history.

Never silently overwrite stock without recording the change.

---

# 11. PRODUCT MANAGEMENT

Create:

**Products**

page.

Features:

- Search
- Filter
- Sort
- Add product
- Edit product
- Deactivate product
- View product
- Upload/change photo

Product cards on mobile should look like:

[IMAGE]

**Bosch 8mm Drill Bit**

Brand: Bosch  
SKU: DRL-008  
Stock: **24 pcs**  
Rack: B-12

---

# 12. DATA SHEET / INVENTORY TABLE

Create a powerful **Inventory Data Sheet** view.

This should feel somewhat like an Excel/Google Sheets table but be optimized for the web.

Columns:

- Image
- Product Name
- Brand
- Category
- SKU
- Current Stock
- Unit
- Minimum Stock
- Purchase Price
- Selling Price
- Supplier
- Rack
- Updated At
- Actions

### Important

Allow users to:

- Add row
- Edit row
- Delete/deactivate row
- Upload image directly inside the row
- Search
- Filter
- Sort
- Bulk edit where appropriate

The image column should have a small thumbnail.

Clicking the thumbnail should open a larger image preview.

On mobile, do NOT force a huge horizontal table.

Use responsive cards or a horizontally scrollable data table with important fields fixed/visible.

---

# 13. EXCEL IMPORT / EXPORT

Provide:

### Import Excel

Allow admin to upload an existing Excel inventory sheet.

Map columns such as:

Product Name  
Brand  
Category  
SKU  
Stock  
Unit  
Price  
Supplier  
Rack

Before importing:

Show a preview.

Validate:

- Missing product name
- Invalid stock quantity
- Duplicate SKU
- Invalid values

Then allow:

**CONFIRM IMPORT**

### Export

Allow exporting current inventory to:

- Excel (.xlsx)
- CSV

Export should include product information and stock information.

Do not export image binaries into the spreadsheet unnecessarily.

Instead include an image URL/reference column if useful.

---

# 14. REAL-TIME SYNC

This is a CRITICAL requirement.

Use real-time database subscriptions.

When:

- Product is added
- Product is edited
- Product image is changed
- Stock is increased
- Stock is decreased
- Stock is adjusted
- Product is deactivated

All connected clients must update automatically.

No manual page refresh.

Show a small status indicator:

🟢 Live

If connection is lost:

🟠 Reconnecting...

Do not silently show stale information.

---

# 15. USERS & PERMISSIONS

Implement authentication.

Roles:

### Admin

Can:

- Add products
- Edit products
- Delete/deactivate products
- Upload images
- Modify prices
- Adjust stock
- Import Excel
- Export data
- Manage users
- View complete history

### Staff

Can:

- Search products
- View stock
- Stock In
- Stock Out
- View relevant history

Staff should not be able to permanently delete products or change sensitive settings.

---

# 16. MOBILE-FIRST UI

This application will primarily be used on phones inside a hardware shop.

Design accordingly.

Large touch-friendly buttons.

Avoid tiny icons.

Avoid unnecessary popups.

Important information should be visible immediately.

Bottom navigation on mobile:

**Dashboard | Products | Stock | History | More**

Floating quick action can be used for:

`+ Stock`

Search should always be easy to access.

---

# 17. SPEED & PERFORMANCE

Speed is one of the highest priorities.

The app should feel instant.

Requirements:

- Fast initial load
- Lazy-load product images
- Compress images
- Use thumbnails
- Pagination/infinite scrolling
- Debounced search
- Indexed database fields
- Efficient queries
- Avoid fetching unnecessary columns
- Cache where appropriate
- Optimistic UI updates where safe
- Do not reload the entire product list after every change

For example:

If one product is updated, do NOT fetch all 5,000 products again.

Update only the changed record in the UI.

---

# 18. HARDWARE SHOP CATEGORIES

Initially support categories such as:

- Electrical
- Plumbing
- Hardware
- Tools
- Fasteners
- Paint
- Adhesives
- Safety Equipment
- Construction Materials
- Sanitary
- Pipes & Fittings
- Power Tools
- Hand Tools
- Other

Admin should be able to add/edit categories later.

Do not hard-code the category system in a way that prevents future changes.

---

# 19. PRODUCT DETAIL PAGE

When a user clicks a product, show:

Large Product Image

**Product Name**

Brand

SKU

Category

Current Stock

Unit

Minimum Stock

Purchase Price

Selling Price

Supplier

Rack

Last Updated

### Stock Actions

`+ Stock In`

`− Stock Out`

### Recent Movement

Show recent transactions for that product.

---

# 20. IMAGE-FIRST PRODUCT IDENTIFICATION

Make visual identification a core part of the UX.

For every product card:

**IMAGE FIRST**

then:

Product Name  
Brand  
Stock

Example:

┌─────────────────────┐
│                     │
│     PRODUCT IMAGE   │
│                     │
└─────────────────────┘

**Asian Paints Primer**

Brand: Asian Paints

Stock: 12 L

Rack: P-04

This should make it possible for a staff member who doesn't know the exact product name to recognize it visually.

---

# 21. OPTIONAL BARCODE / QR SUPPORT

Structure the system so barcode/QR scanning can be added.

If supported by the device:

Scan barcode → product opens immediately.

Do not make barcode scanning mandatory for the MVP.

---

# 22. DATABASE DESIGN

Create proper relational tables.

At minimum:

### products

id  
name  
brand_id  
category_id  
sku  
description  
image_url  
unit  
current_stock  
minimum_stock  
reorder_level  
purchase_price  
selling_price  
supplier_id  
rack  
is_active  
created_at  
updated_at  
created_by  
updated_by

### brands

id  
name  
created_at

### categories

id  
name  
parent_category_id  
created_at

### suppliers

id  
name  
phone  
email  
address

### stock_transactions

id  
product_id  
type  
quantity  
previous_stock  
new_stock  
reason  
reference  
user_id  
created_at

### users

id  
name  
email  
role  
created_at

Use proper foreign keys and indexes.

Add indexes for commonly searched fields such as:

- product name
- SKU
- brand
- category
- current stock

---

# 23. SECURITY

Use proper authentication and authorization.

Use Supabase Row Level Security where applicable.

Do not expose service-role keys on the frontend.

Validate all stock operations server-side/database-side where appropriate.

Prevent unauthorized users from modifying inventory.

---

# 24. ERROR HANDLING

Never silently fail.

If an operation fails:

Show:

**Something went wrong. Please try again.**

Do not lose user-entered information unnecessarily.

For stock operations, prevent duplicate submissions if the user taps the button multiple times.

---

# 25. UI STYLE

Keep the UI professional but simple.

Brand:

**Bahubali Enterprises**

Use a clean hardware-business feel.

Do not make it look like a complicated ERP.

It should feel like:

> “Open app → search item → see photo → see stock → done.”

Use clear typography.

Good spacing.

Large buttons.

Readable stock numbers.

Use visual indicators:

🟢 In Stock  
🟡 Low Stock  
🔴 Out of Stock

Avoid excessive animations.

---

# 26. MVP PRIORITY

If you need to prioritize development, build in this order:

### P0 - MUST WORK

1. Authentication
2. Product database
3. Product image upload
4. Product search
5. Current stock
6. Stock In
7. Stock Out
8. Real-time sync
9. Mobile responsive UI
10. Product detail page

### P1

11. Stock history
12. Low stock alerts
13. Excel import
14. Excel export
15. Admin/staff roles
16. Categories/brands/suppliers
17. Stock adjustment

### P2

18. Barcode scanning
19. Advanced analytics
20. Purchase/supplier management
21. Reports
22. Advanced dashboard

Do not sacrifice P0 functionality for unnecessary P2 features.

---

# 27. IMPORTANT DEVELOPMENT RULES

Do not just create a visual prototype.

Build the actual working application.

Do not use mock data as the primary data source.

Connect the frontend to the real database.

Test:

- Add product
- Upload image
- Edit product
- Search product
- Stock In
- Stock Out
- Stock adjustment
- Real-time updates
- Login/logout
- Permissions
- Excel import/export

Test the application on mobile dimensions as well as desktop.

---

# 28. SEED DATA

Create a small set of realistic demo products for development/testing.

Examples:

- Bosch 8mm Drill Bit
- Asian Paints Primer
- Polycab 2.5mm Wire
- Taparia Screwdriver Set
- Finolex PVC Pipe
- Dr. Fixit Waterproofing
- Stanley Hammer
- Anchor Switch
- SS Screws
- PVC Elbow

Give each demo product:

- Brand
- Category
- Stock
- Unit
- Minimum stock
- Rack
- Price

Use placeholder/demo images only for development. The actual application must support real image uploads.

---

# 29. FINAL UX TEST

Before considering the application complete, perform this test:

### Scenario

A shop employee receives a customer request:

> “Bosch ka 8mm drill bit hai?”

The employee should be able to:

1. Open app
2. Search `Bosch` or `8mm`
3. See product image
4. Confirm visually that it is the correct Bosch product
5. See current stock
6. See rack location
7. Answer the customer

Target:

**Under 10 seconds.**

Another scenario:

Two employees are using the app simultaneously.

Employee A removes 5 units.

Employee B should see the new stock immediately.

No page refresh.

---

# 30. BUILD INSTRUCTIONS

Start by creating the complete application architecture.

Then:

1. Set up database
2. Set up authentication
3. Set up storage for product images
4. Create database schema
5. Implement real-time subscriptions
6. Build mobile UI
7. Build product management
8. Build image upload
9. Build search
10. Build Stock In/Out
11. Build history
12. Build dashboard
13. Build Excel import/export
14. Add permissions
15. Test thoroughly
16. Optimize performance
17. Fix all errors
18. Ensure the application is deployable

Do not stop at the UI.

If something is unclear, choose the simplest practical implementation that matches the requirements instead of adding unnecessary complexity.

The final product should feel like a **fast, simple, real-time digital stock register specifically designed for Bahubali Enterprises**, not a generic enterprise ERP.