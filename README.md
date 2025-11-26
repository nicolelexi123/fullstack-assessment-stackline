## Stackline Full Stack Assignment

This is a small e‑commerce demo used for the Stackline full‑stack engineering assignment.  
It includes:

- **Product list page** with search, category and subcategory filters  
- **Product detail page** with images, feature bullets and meta information  
- **REST APIs** implemented using Next.js Route Handlers for products, categories and subcategories

This README documents how to run the project, what I changed, and why I made each change.

---

## 1. Getting Started

### 1.1 Requirements

- **Node.js**: recommended **>= 18**
- **Package manager**: either **Yarn** or **npm**

### 1.2 Install & Run

Using **Yarn** (original instructions):
This is a small e‑commerce demo used for the Stackline full‑stack engineering assignment.  
It includes:

- **Product list page** with search, category and subcategory filters  
- **Product detail page** with images, feature bullets and meta information  
- **REST APIs** implemented using Next.js Route Handlers for products, categories and subcategories

This README documents how to run the project, what I changed, and why I made each change.

---

## 1. Getting Started

### 1.1 Requirements

- **Node.js**: recommended **>= 18**
- **Package manager**: either **Yarn** or **npm**

### 1.2 Install & Run

Using **Yarn** (original instructions):

```bash
yarn install
yarn dev
```

I mainly used `npm install` / `npm run dev` locally.  
The repo still contains the original `yarn.lock`, so other people can also use `yarn install` / `yarn dev` if prefer.
Using **npm** (equivalent alternative):

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`:

- `/` – product list (search + category/subcategory filters)
- `/product` – product detail page, driven by an SKU query parameter

---

## 2. Architecture Overview

- `app/layout.tsx` – root layout, global fonts, and document metadata
- `app/page.tsx` – product list + search and filter UI
- `app/product/page.tsx` – product detail page (fetches by SKU via API)
- `app/api/products/route.ts` – products list API (search, category/subcategory filters, pagination params)
- `app/api/products/[sku]/route.ts` – single product detail API
- `app/api/categories/route.ts` – categories list API
- `app/api/subcategories/route.ts` – subcategories list API (optionally filtered by category)
- `lib/products.ts` – `ProductService` abstraction over `sample-products.json`
- `components/ui/*` – shared UI components built with Radix + Tailwind (`Button`, `Input`, `Select`, `Card`, `Badge`, etc.)

Data flow:  
`sample-products.json` → `ProductService` → `/api/...` routes → React pages via `fetch` → UI components.

---

## 3. Issues Found and Fixes (by Priority)

I grouped issues by impact: 

### P1 – High Impact / Can Break Main Flow

#### P1‑1 Detail page trusted raw JSON in URL (refresh/deeplink & integrity problems)

- **Original behavior**
  - `app/page.tsx` built links like:
    - `href={{ pathname: "/product", query: { product: JSON.stringify(product) } }}`  
  - `app/product/page.tsx` read `product` from the query string and did `JSON.parse` on the client.
- **Problems**
  - URLs become very long and fragile; refreshing `/product` without a valid `product` param shows only “Product not found”.
  - Anyone can edit the URL query and completely fake product data (title, price, features, etc.).
- **Fix**
  - Change list page to pass **only the SKU**:
    - `query: { sku: product.stacklineSku }` in `app/page.tsx`.
  - Change detail page to:
    - Read `sku` via `useSearchParams().get('sku')`.
    - Fetch the real product from `/api/products/[sku]`.
    - Add explicit `loading` and `error` states and show messages for 404 vs. network/server errors.
    - Use the shared `Product` type from `lib/products.ts` instead of a local interface.
- **Why**
  - All detail data now comes from a trusted backend API instead of untrusted URL JSON.
  - Refreshing and deep‑linking to `/product?sku=...` works reliably.
  - Frontend and backend share the same product shape, which reduces drift.

#### P1‑2 List → detail product shape mismatch (possible runtime crash)

- **Original behavior**
  - The list page `Product` type only included:
    - `stacklineSku`, `title`, `categoryName`, `subCategoryName`, `imageUrls`.
  - The detail page expected additional fields:
    - `featureBullets`, `retailerSku` and others, and used `product.featureBullets.length` directly.
- **Problems**
  - If the object passed from the list were ever missing `featureBullets`, the detail page would crash at runtime.
  - In practice the sample data is complete, but the code is fragile and tightly coupled to the client‑side object.
- **Fix**
  - With the new approach, the detail page fetches the full `Product` from the API using the SKU.
  - It also checks `Array.isArray(product.featureBullets)` before rendering, so malformed data fails gracefully.
- **Why**
  - Detail rendering no longer depends on whatever subset the list happened to pass.
  - The component is robust even if future data changes or becomes partially incomplete.


#### P1‑3 Product list loading state never ended on errors

- **Original behavior**
  - `setLoading(true)` was called before fetching `/api/products`, and `setLoading(false)` was only called in `.then`.
  - There was no `.catch` or `.finally`.
- **Problems**
  - On network failures or non‑OK responses, the list stayed forever in the “Loading products...” state.
  - Users couldn’t tell if the app was still working or had failed, and they had no retry option.
- **Fix**
  - Introduced an `error` state in `app/page.tsx`.
  - Before each request: `setError(null); setLoading(true);`.
  - Checked `res.ok`; non‑OK responses now throw.
  - In `.catch`: log the error, set a user‑friendly error message, and clear `products`.
  - In `.finally`: always call `setLoading(false)`.
  - In the UI: added an `error` rendering branch that shows the message and (optionally) a retry button.
- **Why**
  - The list page reliably transitions from loading → error or loading → data.
  - Users get clear feedback and can try again instead of being stuck in an infinite spinner.

#### P1‑4 Subcategories API was called without category (filtering behavior incorrect)

- **Original behavior**
  - Frontend code:
    - `fetch("/api/subcategories")` when a category was selected.
  - Backend API:
    - `GET /api/subcategories?category=...` optionally filters subcategories by category.
- **Problems**
  - Because the frontend never sent the `category` parameter, the API always returned **all** subcategories.
  - Users could choose invalid category/subcategory combinations (subcategory not belonging to the chosen category), often resulting in empty search results and confusion.
- **Fix**
  - In `app/page.tsx`, when `selectedCategory` is set:
    - Build `URLSearchParams` with `category`.
    - Call `fetch(\`/api/subcategories?${params.toString()}\`)`.
  - When category is cleared, reset subcategories and `selectedSubCategory`.
- **Why**
  - Subcategory options now correctly depend on the selected category.
  - Filter combinations are intuitive and reflect the actual dataset.


### P2 – Medium Impact 

#### P2‑1 `/api/products/[sku]` handler type signature did not match Next’s contract

- **Original code**

  ```ts
  export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sku: string }> }
  ) {
    const { sku } = await params;
    ...
  }
  ```

- **Problems**
  - Next passes `{ params: { sku: string } }` synchronously; it is not a `Promise`.
  - The type definition misrepresented how the framework actually works and could easily mislead future changes.
- **Fix**

  ```ts
  export async function GET(
    request: NextRequest,
    { params }: { params: { sku: string } }
  ) {
    const { sku } = params;
    ...
  }
  ```

- **Why**
  - Type definitions now reflect the true contract, improving readability and reducing future bugs.

#### P2‑2 Search fired a request on every keystroke (no debouncing)

- **Original behavior**
  - `search` was part of the dependency array for the fetch effect.
  - Every `onChange` in the search input triggered an immediate call to `/api/products`.
- **Problems**
  - Typing `"kindle"` could easily trigger 6+ requests.
  - On slower networks or with larger datasets, this would waste resources and create a jittery UI.
- **Fix**
  - Added a `debouncedSearch` state and a `useEffect` that updates it 2 seconds after the user stops typing

  - The products fetch effect now depends on `debouncedSearch` instead of `search`.
- **Why**
  - The list only refreshes when the user pauses typing, significantly reducing API calls and improving UX.

#### P2‑3 Category/subcategory had Select value issues


- **Problems**
  - UX: users didn’t see a clear way to go back to “All” from the dropdown itself; they had to rely on a separate “Clear Filters” button.
  - Runtime: using `value=""` caused a Radix runtime error:  
    “A `<Select.Item />` must have a value prop that is not an empty string…”.
- **Fix**
  - Introduced explicit sentinel values:

    ```ts
    const ALL_CATEGORIES = "__all_categories__";
    const ALL_SUBCATEGORIES = "__all_subcategories__";
    ```

  - Category select:

    ```tsx
    <Select
      value={selectedCategory ?? ALL_CATEGORIES}
      onValueChange={(value) => {
        if (value === ALL_CATEGORIES) {
          setSelectedCategory(undefined);
        } else {
          setSelectedCategory(value);
        }
      }}
    >
      <SelectTrigger className="w-full md:w-[200px]">
        <SelectValue placeholder="All Categories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_CATEGORIES}>All Categories</SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat} value={cat}>
            {cat}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    ```

  - Subcategory select uses `ALL_SUBCATEGORIES` in the same way.
- **Why**
  - The dropdowns now surface a clear “All …” option.
  - Radix `Select` receives only non‑empty string values, eliminating the runtime error.


#### P2‑4 Tag click behavior: category tags now filter instead of navigating to detail

- **Original behavior**
  - Each product card was wrapped in a `<Link>` to `/product`.
  - Clicking anywhere inside the card—including category and subcategory badges—navigated to the detail page.
- **Problems**
  - From a UX standpoint, badges look like filters/tags, not navigation links.
  - Users might expect clicking a badge to filter by that category, not open details.
- **Fix**
  - Kept the card itself as a link to detail, but changed badge click behavior:

    ```tsx
    <Badge
      variant="secondary"
      className="cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCategory(product.categoryName);
        setSelectedSubCategory(undefined);
      }}
    >
      {product.categoryName}
    </Badge>

    <Badge
      variant="outline"
      className="cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCategory(product.categoryName);
        setSelectedSubCategory(product.subCategoryName);
      }}
    >
      {product.subCategoryName}
    </Badge>
    ```

- **Why**
  - Clicking a badge now behaves like a filter, which is more intuitive.
  - Preventing event propagation keeps the card `Link` behavior intact when users click elsewhere.



### P3 – Low Impact / Polish

#### P3‑1 Product card footer alignment

- **Issue**
  - Because the card is a `flex flex-col` container and content heights vary, `View Details` buttons were not aligned across rows.
- **Fix**
  - Added `mt-auto` to `CardFooter` so the footer sticks to the bottom of the card:

    ```tsx
    <CardFooter className="mt-auto">
      <Button variant="outline" className="w-full">
        View Details
      </Button>
    </CardFooter>
    ```

- **Why**
  - All cards in a row now align their actions visually, improving visual consistency.

---


#### P3‑2 Layout metadata still had scaffolded defaults

- **Original code**

  ```ts
  export const metadata: Metadata = {
    title: "Create Next App",
    description: "Generated by create next app",
  };
  ```

- **Fix**

  ```ts
  export const metadata: Metadata = {
    title: "StackShop - Sample eCommerce",
    description:
      "Sample eCommerce experience for the Stackline full-stack assessment.",
  };
  ```

- **Why**
  - Reflects the real purpose of the app and improves the first impression and SEO.

---

## 4. Manual Regression Test Plan

I used the following scenarios to validate the changes; you can repeat them locally:

1. **Happy path**
   - Open `/` and verify that the default product list loads.
   - Type into the search box and confirm that results refresh only after a short pause (debounce).
   - Select a category and subcategory and confirm subcategories filter based on the chosen category.
   - Click badges to filter by category/subcategory and ensure results update correctly.
   - Click “View Details” on a product and verify the detail page loads with images and feature bullets.

2. **Refresh and deep‑linking**
   - On the detail page, refresh the browser; confirm the product is refetched by SKU.
   - Manually visit `/product?sku=non-existing` and verify you see a friendly “Product not found” message.

3. **Error and offline behavior**
   - In DevTools Network tab, simulate offline or introduce a temporary API failure.
   - Confirm the list page shows the error message instead of staying stuck on “Loading products...”.
   - Restore connectivity and verify the list recovers when filters/search are updated.

---

## 5. Summary

In this assignment I focused on:

- **Correctness & robustness**
  - Moved the detail page to fetch by SKU from the backend instead of trusting URL JSON.
  - Fixed filtering and loading behavior to avoid fragile or confusing states.
- **User experience**
  - Added debounced search, clear “All” options in filters, filterable badges, and aligned actions.
  - Improved error handling so failures are visible and recoverable.
- **Maintainability & clarity**
  - Aligned API handler types with Next conventions.
  - Cleaned up metadata and clarified where key logic lives in the codebase.
I mainly used `npm install` / `npm run dev` locally.  
The repo still contains the original `yarn.lock`, so other people can also use `yarn install` / `yarn dev` if prefer.
Using **npm** (equivalent alternative):

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`:

- `/` – product list (search + category/subcategory filters)
- `/product` – product detail page, driven by an SKU query parameter

---

## 2. Architecture Overview

- `app/layout.tsx` – root layout, global fonts, and document metadata
- `app/page.tsx` – product list + search and filter UI
- `app/product/page.tsx` – product detail page (fetches by SKU via API)
- `app/api/products/route.ts` – products list API (search, category/subcategory filters, pagination params)
- `app/api/products/[sku]/route.ts` – single product detail API
- `app/api/categories/route.ts` – categories list API
- `app/api/subcategories/route.ts` – subcategories list API (optionally filtered by category)
- `lib/products.ts` – `ProductService` abstraction over `sample-products.json`
- `components/ui/*` – shared UI components built with Radix + Tailwind (`Button`, `Input`, `Select`, `Card`, `Badge`, etc.)

Data flow:  
`sample-products.json` → `ProductService` → `/api/...` routes → React pages via `fetch` → UI components.

---

## 3. Issues Found and Fixes (by Priority)

I grouped issues by impact: 

### P1 – High Impact / Can Break Main Flow

#### P1‑1 Detail page trusted raw JSON in URL (refresh/deeplink & integrity problems)

- **Original behavior**
  - `app/page.tsx` built links like:
    - `href={{ pathname: "/product", query: { product: JSON.stringify(product) } }}`  
  - `app/product/page.tsx` read `product` from the query string and did `JSON.parse` on the client.
- **Problems**
  - URLs become very long and fragile; refreshing `/product` without a valid `product` param shows only “Product not found”.
  - Anyone can edit the URL query and completely fake product data (title, price, features, etc.).
- **Fix**
  - Change list page to pass **only the SKU**:
    - `query: { sku: product.stacklineSku }` in `app/page.tsx`.
  - Change detail page to:
    - Read `sku` via `useSearchParams().get('sku')`.
    - Fetch the real product from `/api/products/[sku]`.
    - Add explicit `loading` and `error` states and show messages for 404 vs. network/server errors.
    - Use the shared `Product` type from `lib/products.ts` instead of a local interface.
- **Why**
  - All detail data now comes from a trusted backend API instead of untrusted URL JSON.
  - Refreshing and deep‑linking to `/product?sku=...` works reliably.
  - Frontend and backend share the same product shape, which reduces drift.

#### P1‑2 List → detail product shape mismatch (possible runtime crash)

- **Original behavior**
  - The list page `Product` type only included:
    - `stacklineSku`, `title`, `categoryName`, `subCategoryName`, `imageUrls`.
  - The detail page expected additional fields:
    - `featureBullets`, `retailerSku` and others, and used `product.featureBullets.length` directly.
- **Problems**
  - If the object passed from the list were ever missing `featureBullets`, the detail page would crash at runtime.
  - In practice the sample data is complete, but the code is fragile and tightly coupled to the client‑side object.
- **Fix**
  - With the new approach, the detail page fetches the full `Product` from the API using the SKU.
  - It also checks `Array.isArray(product.featureBullets)` before rendering, so malformed data fails gracefully.
- **Why**
  - Detail rendering no longer depends on whatever subset the list happened to pass.
  - The component is robust even if future data changes or becomes partially incomplete.


#### P1‑3 Product list loading state never ended on errors

- **Original behavior**
  - `setLoading(true)` was called before fetching `/api/products`, and `setLoading(false)` was only called in `.then`.
  - There was no `.catch` or `.finally`.
- **Problems**
  - On network failures or non‑OK responses, the list stayed forever in the “Loading products...” state.
  - Users couldn’t tell if the app was still working or had failed, and they had no retry option.
- **Fix**
  - Introduced an `error` state in `app/page.tsx`.
  - Before each request: `setError(null); setLoading(true);`.
  - Checked `res.ok`; non‑OK responses now throw.
  - In `.catch`: log the error, set a user‑friendly error message, and clear `products`.
  - In `.finally`: always call `setLoading(false)`.
  - In the UI: added an `error` rendering branch that shows the message and (optionally) a retry button.
- **Why**
  - The list page reliably transitions from loading → error or loading → data.
  - Users get clear feedback and can try again instead of being stuck in an infinite spinner.

#### P1‑4 Subcategories API was called without category (filtering behavior incorrect)

- **Original behavior**
  - Frontend code:
    - `fetch("/api/subcategories")` when a category was selected.
  - Backend API:
    - `GET /api/subcategories?category=...` optionally filters subcategories by category.
- **Problems**
  - Because the frontend never sent the `category` parameter, the API always returned **all** subcategories.
  - Users could choose invalid category/subcategory combinations (subcategory not belonging to the chosen category), often resulting in empty search results and confusion.
- **Fix**
  - In `app/page.tsx`, when `selectedCategory` is set:
    - Build `URLSearchParams` with `category`.
    - Call `fetch(\`/api/subcategories?${params.toString()}\`)`.
  - When category is cleared, reset subcategories and `selectedSubCategory`.
- **Why**
  - Subcategory options now correctly depend on the selected category.
  - Filter combinations are intuitive and reflect the actual dataset.


### P2 – Medium Impact 

#### P2‑1 `/api/products/[sku]` handler type signature did not match Next’s contract

- **Original code**

  ```ts
  export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ sku: string }> }
  ) {
    const { sku } = await params;
    ...
  }
  ```

- **Problems**
  - Next passes `{ params: { sku: string } }` synchronously; it is not a `Promise`.
  - The type definition misrepresented how the framework actually works and could easily mislead future changes.
- **Fix**

  ```ts
  export async function GET(
    request: NextRequest,
    { params }: { params: { sku: string } }
  ) {
    const { sku } = params;
    ...
  }
  ```

- **Why**
  - Type definitions now reflect the true contract, improving readability and reducing future bugs.

#### P2‑2 Search fired a request on every keystroke (no debouncing)

- **Original behavior**
  - `search` was part of the dependency array for the fetch effect.
  - Every `onChange` in the search input triggered an immediate call to `/api/products`.
- **Problems**
  - Typing `"kindle"` could easily trigger 6+ requests.
  - On slower networks or with larger datasets, this would waste resources and create a jittery UI.
- **Fix**
  - Added a `debouncedSearch` state and a `useEffect` that updates it 2 seconds after the user stops typing

  - The products fetch effect now depends on `debouncedSearch` instead of `search`.
- **Why**
  - The list only refreshes when the user pauses typing, significantly reducing API calls and improving UX.

#### P2‑3 Category/subcategory had Select value issues


- **Problems**
  - UX: users didn’t see a clear way to go back to “All” from the dropdown itself; they had to rely on a separate “Clear Filters” button.
  - Runtime: using `value=""` caused a Radix runtime error:  
    “A `<Select.Item />` must have a value prop that is not an empty string…”.
- **Fix**
  - Introduced explicit sentinel values:

    ```ts
    const ALL_CATEGORIES = "__all_categories__";
    const ALL_SUBCATEGORIES = "__all_subcategories__";
    ```

  - Category select:

    ```tsx
    <Select
      value={selectedCategory ?? ALL_CATEGORIES}
      onValueChange={(value) => {
        if (value === ALL_CATEGORIES) {
          setSelectedCategory(undefined);
        } else {
          setSelectedCategory(value);
        }
      }}
    >
      <SelectTrigger className="w-full md:w-[200px]">
        <SelectValue placeholder="All Categories" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL_CATEGORIES}>All Categories</SelectItem>
        {categories.map((cat) => (
          <SelectItem key={cat} value={cat}>
            {cat}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
    ```

  - Subcategory select uses `ALL_SUBCATEGORIES` in the same way.
- **Why**
  - The dropdowns now surface a clear “All …” option.
  - Radix `Select` receives only non‑empty string values, eliminating the runtime error.


#### P2‑4 Tag click behavior: category tags now filter instead of navigating to detail

- **Original behavior**
  - Each product card was wrapped in a `<Link>` to `/product`.
  - Clicking anywhere inside the card—including category and subcategory badges—navigated to the detail page.
- **Problems**
  - From a UX standpoint, badges look like filters/tags, not navigation links.
  - Users might expect clicking a badge to filter by that category, not open details.
- **Fix**
  - Kept the card itself as a link to detail, but changed badge click behavior:

    ```tsx
    <Badge
      variant="secondary"
      className="cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCategory(product.categoryName);
        setSelectedSubCategory(undefined);
      }}
    >
      {product.categoryName}
    </Badge>

    <Badge
      variant="outline"
      className="cursor-pointer"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedCategory(product.categoryName);
        setSelectedSubCategory(product.subCategoryName);
      }}
    >
      {product.subCategoryName}
    </Badge>
    ```

- **Why**
  - Clicking a badge now behaves like a filter, which is more intuitive.
  - Preventing event propagation keeps the card `Link` behavior intact when users click elsewhere.



### P3 – Low Impact / Polish

#### P3‑1 Product card footer alignment

- **Issue**
  - Because the card is a `flex flex-col` container and content heights vary, `View Details` buttons were not aligned across rows.
- **Fix**
  - Added `mt-auto` to `CardFooter` so the footer sticks to the bottom of the card:

    ```tsx
    <CardFooter className="mt-auto">
      <Button variant="outline" className="w-full">
        View Details
      </Button>
    </CardFooter>
    ```

- **Why**
  - All cards in a row now align their actions visually, improving visual consistency.

---


#### P3‑2 Layout metadata still had scaffolded defaults

- **Original code**

  ```ts
  export const metadata: Metadata = {
    title: "Create Next App",
    description: "Generated by create next app",
  };
  ```

- **Fix**

  ```ts
  export const metadata: Metadata = {
    title: "StackShop - Sample eCommerce",
    description:
      "Sample eCommerce experience for the Stackline full-stack assessment.",
  };
  ```

- **Why**
  - Reflects the real purpose of the app and improves the first impression and SEO.

---

## 4. Manual Regression Test Plan

I used the following scenarios to validate the changes; you can repeat them locally:

1. **Happy path**
   - Open `/` and verify that the default product list loads.
   - Type into the search box and confirm that results refresh only after a short pause (debounce).
   - Select a category and subcategory and confirm subcategories filter based on the chosen category.
   - Click badges to filter by category/subcategory and ensure results update correctly.
   - Click “View Details” on a product and verify the detail page loads with images and feature bullets.

2. **Refresh and deep‑linking**
   - On the detail page, refresh the browser; confirm the product is refetched by SKU.
   - Manually visit `/product?sku=non-existing` and verify you see a friendly “Product not found” message.

3. **Error and offline behavior**
   - In DevTools Network tab, simulate offline or introduce a temporary API failure.
   - Confirm the list page shows the error message instead of staying stuck on “Loading products...”.
   - Restore connectivity and verify the list recovers when filters/search are updated.

---

## 5. Summary

In this assignment I focused on:

- **Correctness & robustness**
  - Moved the detail page to fetch by SKU from the backend instead of trusting URL JSON.
  - Fixed filtering and loading behavior to avoid fragile or confusing states.
- **User experience**
  - Added debounced search, clear “All” options in filters, filterable badges, and aligned actions.
  - Improved error handling so failures are visible and recoverable.
- **Maintainability & clarity**
  - Aligned API handler types with Next conventions.
  - Cleaned up metadata and clarified where key logic lives in the codebase.
