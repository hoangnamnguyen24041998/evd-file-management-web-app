# EVD File Management Admin

This project is a admin screen for module document management. It includes:

- document listing with pagination, search, and filters
- inline editing directly in the table
- create, delete, and bulk import flows
- mock API integration with MSW for development
- responsive UI with role-based visibility

## Prerequisites

- Node.js 18+
- Yarn

## Installation

```bash
yarn install
```

## Run locally

```bash
yarn dev
```

Then open <http://localhost:5173/>

## Build for production

```bash
yarn build
```

## Notes

- The app uses a mock API in development via MSW, so no backend is required to try the UI.
- Bulk import accepts CSV or Excel files and reports invalid rows after validation.
