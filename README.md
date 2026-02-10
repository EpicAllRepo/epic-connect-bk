# Epic Connect - Backend API

Email Marketing Platform Backend built with Node.js, Express, TypeScript, and MongoDB.

## 🚀 Features

- ✅ **Contact Management** - Create, update, delete contacts with first name & last name support
- ✅ **List Management** - Organize contacts into lists
- ✅ **Campaign System** - Create and schedule email campaigns
- ✅ **Email Personalization** - Use `@firstName`, `@lastName`, `@name` in email templates
- ✅ **Bulk Upload** - Import contacts via CSV/Excel files
- ✅ **Background Email Processing** - Automatic email queue with throttling
- ✅ **SMTP Configuration** - Support for any SMTP provider
- ✅ **Dashboard Analytics** - Real-time statistics

## 📋 Prerequisites

- Node.js (v16 or higher)
- MongoDB Atlas account or local MongoDB
- SMTP credentials (Gmail, Outlook, AWS SES, etc.)

## 🛠️ Installation

1. Clone the repository

```bash
git clone <repository-url>
cd epic-connect-bk
```

2. Install dependencies

```bash
npm install
```

3. Create `.env` file

```bash
cp .env.example .env
```

4. Update `.env` with your credentials

```env
PORT=5001
MONGO_URI=mongodb+srv://username:password@cluster.mongodb.net/database-name
```

5. Start development server

```bash
npm run dev
```

Server will run on `http://localhost:5001`

## 📚 API Endpoints

### Base URL: `http://localhost:5001/api`

### Contacts

- `GET /contacts` - Get all contacts
- `POST /contacts` - Create contact
- `PUT /contacts/:id` - Update contact
- `DELETE /contacts/:id` - Delete contact
- `POST /contacts/upload` - Bulk upload CSV/Excel
- `POST /contacts/import` - Import JSON array

### Lists

- `GET /lists` - Get all lists
- `POST /lists` - Create list
- `PUT /lists/:id` - Update list
- `DELETE /lists/:id` - Delete list
- `POST /lists/assign` - Assign contacts to lists

### Campaigns

- `GET /campaigns` - Get all campaigns
- `POST /campaigns` - Create campaign
- `DELETE /campaigns/:id` - Delete campaign

### SMTP

- `GET /smtp` - Get SMTP config
- `POST /smtp` - Create SMTP config
- `PUT /smtp/:id` - Update SMTP config

### Dashboard

- `GET /dashboard` - Get statistics and recent data

### Sent Emails

- `GET /sent` - Get sent email history

## 🎯 Email Personalization

Use these variables in campaign subject and body:

- `@firstName` - Contact's first name
- `@lastName` - Contact's last name
- `@name` - Full name
- `{{email}}` - Contact's email

**Example:**

```
Subject: Hello @firstName!
Body: Hi @firstName @lastName, welcome to our platform!
```

**Result for contact "Mohsin Khan":**

```
Subject: Hello Mohsin!
Body: Hi Mohsin Khan, welcome to our platform!
```

## 📁 Project Structure

```
src/
├── controllers/      # Business logic
├── models/          # MongoDB schemas
├── routes/          # API routes
├── utils/           # Helper functions
│   ├── emailProcessor.ts    # Background email worker
│   └── personalization.ts   # Email personalization
├── config/          # Database config
├── middlewares/     # File upload
├── app.ts          # Express setup
└── server.ts       # Entry point
```

## 🔧 Scripts

```bash
npm run dev      # Start development server with nodemon
npm run build    # Build TypeScript to JavaScript
npm start        # Start production server
```

## 🌐 CORS Configuration

CORS is enabled for all origins. Update `src/app.ts` if you need to restrict origins:

```typescript
app.use(
  cors({
    origin: "http://your-frontend-url.com",
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);
```

## 📝 Environment Variables

| Variable    | Description               | Example             |
| ----------- | ------------------------- | ------------------- |
| `PORT`      | Server port               | `5001`              |
| `MONGO_URI` | MongoDB connection string | `mongodb+srv://...` |

## 🚨 Important Notes for Frontend Team

1. **Base URL**: All API calls should use `http://localhost:5001/api`
2. **SMTP Required**: Configure SMTP before sending campaigns (`POST /api/smtp`)
3. **Personalization**: Email variables are replaced automatically by backend
4. **File Upload**: Use `multipart/form-data` for CSV/Excel uploads
5. **Background Processing**: Emails are sent every 20 seconds automatically

## 🔐 Security

- `.env` file is gitignored (contains sensitive data)
- SMTP passwords are stored securely in database
- Input validation on all endpoints
- MongoDB injection prevention

## 📞 Support

For issues or questions, contact the backend team.

---

**Status**: ✅ Production Ready
