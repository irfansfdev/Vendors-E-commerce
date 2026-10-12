# Component structure

```text
src/components/
├── account/                - customer account screens and account-only actions
├── admin/                  - admin-only management UIs grouped by feature area
│   ├── categories/         - category management tools
│   ├── deliveries/        - delivery queue and pickup workflow tables
│   ├── orders/            - admin order list and details UI
│   ├── products/          - admin product tables and list views
│   ├── returns/           - admin return review controls
│   ├── reviews/           - review moderation tables
│   ├── riders/            - rider roster and admin rider actions
│   └── shops/             - shops dashboard, tables, products, and charts
├── auth/                   - login, signup, password reset, and auth form UIs
├── cart/                   - cart page and cart-specific display logic
├── catalog/                - storefront browsing, product details, and catalog UI
├── checkout/               - checkout form and purchase funnel components
├── home/                   - home-page hero and section content
├── layout/                 - app shell, navigation, and branding components
├── notifications/         - notification bell and notification-related UI
├── providers/              - app-wide context providers and initialization wrappers
├── returns/                - customer/admin/seller return flow UI shared by return pages
├── rider/                  - rider workflow screens and assignment tables
├── seller/                 - seller-only dashboards, sidebars, and feature subfolders
│   ├── orders/             - seller order table and order tooling
│   ├── products/           - seller product creation/editing and tables
│   ├── returns/            - seller return approval controls
│   ├── settings/           - seller settings and shop media management
│   └── ...                 - any additional seller-specific components stay here
├── shared/                 - cross-domain components used by multiple feature areas
├── ui/                     - generic, reusable building blocks with no domain logic
└── ...                     - other feature-specific folders should mirror the route/domain they serve
```

Keep new components in the folder matching the area that owns the UI. If a component is used across multiple domains, place it in `shared/` or `ui/` instead of duplicating it in a feature folder.
