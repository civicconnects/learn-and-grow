# Admin Panel Setup Guide

## 🎯 What You're Setting Up

A complete admin dashboard where you can:
- View all form submissions in one place
- Manage enrollment applications
- Review employment applications  
- Track tour requests
- Update submission status
- Delete old submissions

## 📋 Prerequisites

- Cloudflare account (you already have this)
- Access to Cloudflare Dashboard
- Your API token (you already used this)

---

## 🚀 Setup Steps

### Step 1: Create Cloudflare KV Namespace

**What is KV?** KV (Key-Value) is Cloudflare's storage system - think of it like a database for your form submissions.

**How to create:**

1. Go to: https://dash.cloudflare.com/

2. Click **Workers & Pages** in the left sidebar

3. Click **KV** tab at the top

4. Click **Create namespace** button

5. Enter name: `learn-and-grow-forms`

6. Click **Add**

7. **IMPORTANT**: Copy the namespace ID that appears
   - It will look like: `abc123def456ghi789jkl012mno345pqr678`
   - Save this somewhere - you'll need it in the next step!

---

### Step 2: Update Your Configuration

Open the file: `wrangler.jsonc` in your project

Find this section:
```json
"kv_namespaces": [
  {
    "binding": "FORMS_STORAGE",
    "id": "preview_id",
    "preview_id": "preview_id"
  }
]
```

Replace BOTH `"preview_id"` with your actual namespace ID:
```json
"kv_namespaces": [
  {
    "binding": "FORMS_STORAGE",
    "id": "abc123def456ghi789jkl012mno345pqr678",
    "preview_id": "abc123def456ghi789jkl012mno345pqr678"
  }
]
```

---

### Step 3: Change Admin Password (IMPORTANT!)

The default password is `admin123` - you should change this!

**Option A: Simple Method (in wrangler.jsonc)**

Find this section:
```json
"vars": {
  "ADMIN_PASSWORD": "admin123"
}
```

Change to your own secure password:
```json
"vars": {
  "ADMIN_PASSWORD": "MySecurePassword123!"
}
```

**Option B: More Secure Method (Cloudflare Secret)**

Run this command:
```bash
cd /home/user/webapp
export CLOUDFLARE_API_TOKEN="your_token_here"
export CLOUDFLARE_ACCOUNT_ID="your_account_id_here"
npx wrangler secret put ADMIN_PASSWORD
```

When prompted, enter your secure password.

---

### Step 4: Deploy Everything

```bash
cd /home/user/webapp

# Build the project
npm run build

# Deploy to Cloudflare Pages
export CLOUDFLARE_API_TOKEN="_LhF4_1m_OpeutQF8SJSaAlnFcsoKkP2YzSpddVB"
export CLOUDFLARE_ACCOUNT_ID="d1c8fbdc6632c5adacb728342f1c860b"
npx wrangler pages deploy dist --project-name learn-and-grow-childcare
```

---

### Step 5: Bind KV to Your Pages Project

**After deployment, you need to connect the KV namespace to your Pages project:**

1. Go to: https://dash.cloudflare.com/

2. Navigate to: **Workers & Pages** → **learn-and-grow-childcare**

3. Click **Settings** tab

4. Scroll to **Functions** section

5. Find **KV Namespace Bindings**

6. Click **Add binding**

7. Fill in:
   - **Variable name**: `FORMS_STORAGE`
   - **KV namespace**: Select `learn-and-grow-forms` (the one you created)

8. Click **Save**

9. You may need to redeploy for changes to take effect

---

## ✅ Testing the Admin Panel

### Access the Admin Panel:
1. Go to: https://www.learnandgrowchildcarecenter.org/admin
   (Or use: https://learn-and-grow-childcare.pages.dev/admin)

2. You should see a login page

3. Enter your password (default: `admin123` or your custom password)

4. You should see the admin dashboard!

### Test Submission Flow:
1. Open your website in a new tab

2. Fill out a tour request form

3. Submit it

4. Go back to admin panel

5. Click **Tour Requests** or refresh

6. You should see your test submission!

---

## 🎨 Admin Panel Features

### Dashboard:
- **Purple card**: Tour requests count
- **Blue card**: Enrollment applications count  
- **Green card**: Employment applications count

Click any card to view those submissions.

### Managing Submissions:
- **View Details**: Click a submission to see all information
- **Mark Reviewed**: Yellow button - mark as reviewed
- **Mark Completed**: Green button - mark as done
- **Delete**: Red button - permanently remove

### Tabs:
- **Tour Requests**: All tour scheduling requests
- **Enrollment Applications**: Complete enrollment forms
- **Employment Applications**: Job applications

---

## 🔒 Security Best Practices

1. **Change the default password immediately!**
   - Use at least 12 characters
   - Include numbers, letters, and symbols
   - Don't use personal information

2. **Keep password secure**
   - Don't share it
   - Don't write it down in plain text
   - Use a password manager

3. **Log out after each session**

4. **Use HTTPS only** (Cloudflare does this automatically)

5. **Monitor access**
   - Check the admin panel regularly
   - Look for unusual submissions

---

## 🐛 Troubleshooting

### Problem: Can't access /admin
**Solution:**
- Make sure you completed Step 5 (KV binding)
- Verify the deployment succeeded
- Try clearing browser cache/cookies
- Use incognito mode to test

### Problem: Login says "Invalid password"
**Solution:**
- Check if you changed the password in wrangler.jsonc
- Try default password: `admin123`
- Redeploy after changing password
- Check for typos

### Problem: No submissions showing up
**Solution:**
- Check KV namespace is bound correctly (Step 5)
- Submit a test form from the website
- Check browser console for errors (F12)
- Verify KV namespace ID in wrangler.jsonc is correct

### Problem: Submissions appear but can't view details
**Solution:**
- Check browser console for JavaScript errors
- Try refreshing the page
- Verify KV binding name is exactly: `FORMS_STORAGE`

---

## 📊 How Data is Stored

### Storage Format:
```json
{
  "id": "tour-1702345678901-abc123",
  "type": "tour",
  "timestamp": "2025-12-11T18:30:00.000Z",
  "status": "new",
  "data": {
    "parentName": "John Doe",
    "email": "john@example.com",
    ...
  }
}
```

### Storage Limits:
- **KV Free Tier**: 
  - 100,000 reads per day
  - 1,000 writes per day
  - 1 GB storage
- This is more than enough for a childcare center!

---

## 📧 Email Integration (Next Step)

The admin panel is ready for email integration. All emails are formatted and ready to send.

**To enable email sending:**
1. Set up Cloudflare Email Routing
2. Configure email service (SendGrid, Resend, or Cloudflare)
3. See README.md for detailed instructions

**For now:** You can see all form submissions in the admin panel!

---

## 🎉 You're All Set!

Your admin panel is ready to use. Every form submission will be:
1. ✅ Saved to Cloudflare KV storage
2. ✅ Visible in your admin dashboard
3. ✅ Organized by type (tours, enrollments, employment)
4. ✅ Manageable with status updates

---

## 🆘 Need Help?

If you get stuck:
1. Check this guide again carefully
2. Review the README.md file
3. Check Cloudflare documentation: https://developers.cloudflare.com/kv/
4. Ask for help with specific error messages

---

**Last Updated**: December 11, 2025
**Version**: 1.0.0
