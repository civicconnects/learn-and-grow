# Learn and Grow Childcare Center Website

## Project Overview
- **Name**: Learn and Grow Childcare Center
- **Goal**: Create an enhanced, SEO-optimized website that showcases the childcare center's commitment to quality education, safety, and child development
- **Features**: 
  - Responsive design with modern UI/UX
  - Comprehensive program information
  - Safety and well-being showcase
  - Educational approach presentation
  - Team profiles
  - Enrollment process guide
  - Parent resources section
  - Testimonials and social proof
  - Contact forms and location information
  - Full SEO optimization with Schema.org structured data

## URLs
- **Production**: https://www.learnandgrowchildcarecenter.me
- **Cloudflare Pages**: https://learn-and-grow-childcare.pages.dev
- **Latest Deployment**: https://59739466.learn-and-grow-childcare.pages.dev
- **GitHub**: https://github.com/marketingaipros/learn-and-grow

## Data Architecture
- **Frontend**: Single-page application with smooth scrolling navigation
- **Backend**: Hono framework on Cloudflare Workers
- **API Endpoints**:
  - `GET /api/contact` - Contact information
  - `POST /api/schedule-tour` - Tour scheduling form
  - `POST /api/enrollment-inquiry` - Enrollment inquiry form
- **Storage**: Currently in-memory (can be enhanced with Cloudflare D1/KV for persistence)

## Key Sections

### 1. Hero Section
- Compelling headline with brand messaging
- Trust signals (badges for licensing, accreditation, ratings)
- Primary CTAs for tour scheduling and enrollment
- Urgency messaging for limited enrollment spots

### 2. Programs Section
Four age-specific programs with detailed information:
- **Infant Care** (6 weeks - 18 months)
- **Toddler Program** (18 months - 3 years)
- **Preschool** (3 - 5 years)
- **School Age Care** (5 - 12 years)

Each program includes:
- Age range and focus areas
- Daily schedule highlights
- Key developmental goals
- Learning outcomes

### 3. Safety & Well-Being
Comprehensive coverage of:
- Staff qualifications and background checks
- Health and hygiene protocols
- Facility security measures
- Nutrition standards
- Emergency preparedness
- Licensing and compliance

### 4. Educational Approach
- Four core developmental areas:
  - Cognitive Development
  - Social-Emotional Growth
  - Physical Development
  - Language & Literacy
- Play-based learning philosophy
- Measurable progress tracking
- Sample learning activities

### 5. Meet the Team
Staff profiles featuring:
- Center Director
- Lead Teachers
- Specialist Educators
- Professional development commitment

### 6. Enrollment & Admission
- Step-by-step enrollment process
- Required documents checklist
- Visual timeline of enrollment steps
- FAQ section
- Contact information

### 7. Parent Resources
- Daily update systems
- Parent conferences
- At-home learning activities
- Multiple communication channels

### 8. Testimonials
- Parent reviews with 4.9/5 rating
- Social proof elements
- Video testimonial section

### 9. Contact & Location
- Complete contact information
- Schedule tour form
- Interactive map placeholder
- Operating hours
- Social media links

## SEO Optimization Features

### Schema.org Structured Data
- Organization schema with complete business information
- LocalBusiness schema for local search
- ChildCare service type
- Individual service schemas for each program
- Aggregate rating data
- Opening hours specification

### On-Page SEO
- Semantic HTML with proper heading hierarchy
- Meta descriptions and keywords
- Open Graph tags for social sharing
- Descriptive alt text for images
- FAQ sections for voice search optimization
- Mobile-responsive design

### Technical SEO
- Fast loading with CDN resources
- Smooth scrolling navigation
- Accessibility considerations
- Clean URL structure
- Sitemap ready

## Tech Stack
- **Framework**: Hono on Cloudflare Workers
- **Frontend**: HTML5, TailwindCSS (via CDN)
- **Icons**: Font Awesome 6.4.0
- **Fonts**: Google Fonts (Poppins, Nunito)
- **HTTP Client**: Axios
- **Deployment**: Cloudflare Pages
- **Development**: Vite + Wrangler

## User Guide

### For Parents:
1. **Browse Programs**: Scroll to the Programs section to find age-appropriate options
2. **Schedule a Tour**: Click the "Schedule Tour" button in the hero section or navigate to the Contact section
3. **Learn About Safety**: Review comprehensive safety measures in the Safety & Well-Being section
4. **Read Testimonials**: See what other parents say about their experiences
5. **Contact Us**: Use the contact form or call directly

### For Administrators:
1. **Update Content**: Modify the `src/index.tsx` file to update any content
2. **Add Programs**: Extend the Programs section with new offerings
3. **Update Staff**: Add or modify team member profiles
4. **Manage Forms**: API endpoints handle form submissions (can be connected to email or database)

## Development Commands

```bash
# Install dependencies
npm install

# Build the project
npm run build

# Start development server
npm run dev:sandbox

# Start with PM2 (recommended for sandbox)
pm2 start ecosystem.config.cjs

# Test the service
npm run test

# Deploy to Cloudflare Pages
npm run deploy:prod

# Clean port 3000
npm run clean-port

# Git commands
npm run git:init
npm run git:status
npm run "git:commit" "Your commit message"
```

## Deployment

### Local Development (Sandbox)
1. Build the project: `npm run build`
2. Start with PM2: `pm2 start ecosystem.config.cjs`
3. Test: `curl http://localhost:3000`
4. Access via GetServiceUrl tool for public URL

### Production Deployment to Cloudflare Pages
1. Setup Cloudflare API key: Call `setup_cloudflare_api_key` tool
2. Build: `npm run build`
3. Create project: `npx wrangler pages project create learn-and-grow-childcare --production-branch main`
4. Deploy: `npm run deploy:prod`
5. Access at: `https://learn-and-grow-childcare.pages.dev`

## Features Implemented
✅ Hero section with CTAs and trust signals  
✅ Four comprehensive program sections  
✅ Safety and well-being showcase  
✅ Educational approach with developmental areas  
✅ Team member profiles  
✅ Enrollment process with visual timeline  
✅ Parent resources and communication  
✅ Testimonials with ratings  
✅ Contact form and location information  
✅ Full Schema.org structured data  
✅ SEO optimization  
✅ Mobile-responsive design  
✅ Smooth scrolling navigation  
✅ Form handling with API endpoints  

## Features Completed Recently
✅ Contact information updated to Louisville, KY location  
✅ Video testimonial section with YouTube embeds  
✅ GitHub repository connected and synced  
✅ Custom domain configured (www.learnandgrowchildcarecenter.me)  
✅ Cloudflare Pages deployment automated  

## Features Not Yet Implemented
- Live chat functionality
- Parent portal login
- Real database integration for form submissions
- Email notifications for form submissions
- Interactive map with Google Maps API (placeholder currently)
- Blog/news section
- Photo gallery with real facility photos
- Calendar integration
- Online payment system

## Recommended Next Steps
1. **Connect Forms to Email**: Integrate SendGrid or similar service for form submissions
2. **Add Database**: Implement Cloudflare D1 for storing inquiries and tour requests
3. **Implement Google Maps**: Replace map placeholder with actual Google Maps embed
4. **Add Content Management**: Consider headless CMS for easier content updates
5. **Upload Real Images**: Replace placeholder images with actual facility photos
6. **Video Integration**: Add real video testimonials
7. **Analytics**: Integrate Google Analytics or Cloudflare Web Analytics
8. **Social Media Integration**: Connect live social media feeds
9. **Blog Section**: Add a blog for parenting tips and center updates
10. **Parent Portal**: Develop secure login area for enrolled families

## Current Status
- **Deployment Status**: ✅ Live and deployed
- **Last Updated**: 2025-12-11
- **Version**: 1.1.0
- **License**: MIT

## 🔐 Admin Panel Setup

### Overview
Your website now includes a **complete admin panel** where you can:
- View all form submissions (tours, enrollments, employment)
- Manage submission status (new, reviewed, completed)
- Delete submissions
- Real-time dashboard with statistics
- Secure password-protected access

### Accessing the Admin Panel
**URL**: https://www.learnandgrowchildcarecenter.me/admin

**Default Login:**
- Password: `admin123`

### Setting Up the Admin Panel (Required Steps)

#### Step 1: Create Cloudflare KV Namespace
1. Go to Cloudflare Dashboard → Workers & Pages
2. Click on "KV" in the left sidebar
3. Click "Create namespace"
4. Name it: `learn-and-grow-forms`
5. Copy the namespace ID (looks like: `a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6`)

#### Step 2: Update wrangler.jsonc
Replace the KV namespace IDs in `wrangler.jsonc`:
```json
"kv_namespaces": [
  {
    "binding": "FORMS_STORAGE",
    "id": "YOUR_NAMESPACE_ID_HERE",
    "preview_id": "YOUR_NAMESPACE_ID_HERE"
  }
]
```

#### Step 3: Change Admin Password (Highly Recommended!)
**Option A: Update in wrangler.jsonc (Simple)**
```json
"vars": {
  "ADMIN_PASSWORD": "your-secure-password-here"
}
```

**Option B: Use Cloudflare Secret (More Secure)**
```bash
npx wrangler secret put ADMIN_PASSWORD
# Enter your secure password when prompted
```

#### Step 4: Deploy
```bash
npm run build
npx wrangler pages deploy dist --project-name learn-and-grow-childcare
```

### Admin Panel Features

**Dashboard:**
- 📊 Real-time statistics for all form types
- 🔔 Visual cards showing submission counts
- 🔄 Auto-refresh every 30 seconds

**Form Management:**
- ✅ View all submissions in organized tabs
- 📝 Detailed view of each submission
- 🏷️ Update status (New → Reviewed → Completed)
- 🗑️ Delete submissions
- 🔍 Search and filter (coming soon)

**Security:**
- 🔒 Password-protected access
- 🍪 Secure cookie-based sessions
- ⏰ 24-hour session timeout
- 🚫 Automatic redirect if not authenticated

### How Form Submissions Work

1. **User submits form** on website
2. **Data is saved** to Cloudflare KV storage
3. **Email notification** is prepared (ready for email service integration)
4. **Admin can view** submission in admin panel
5. **Admin manages** status and follow-up

### Viewing Submissions in Admin Panel

**Tour Requests Show:**
- Parent name and contact info
- Child's name and age
- Preferred tour date
- Program interest
- Additional message

**Enrollment Applications Show:**
- Complete parent information
- Child details and DOB
- Program and start date
- Emergency contacts
- Medical information
- All additional fields

**Employment Applications Show:**
- Applicant contact info
- Position applying for
- Education and certifications
- Experience level
- Work history
- Professional references
- Motivation statement

### Admin Panel Security Tips

1. **Change the default password immediately**
2. **Use a strong, unique password** (at least 12 characters)
3. **Don't share admin credentials**
4. **Use HTTPS only** (automatic with Cloudflare)
5. **Log out after each session**
6. **Consider using Cloudflare Access** for additional security layer

### Troubleshooting

**Can't access /admin:**
- Make sure you've deployed the latest version
- Check that KV namespace is created and configured
- Verify wrangler.jsonc has correct namespace ID

**Login not working:**
- Verify ADMIN_PASSWORD is set correctly
- Try default password: `admin123`
- Check browser console for errors
- Clear cookies and try again

**Submissions not appearing:**
- Verify KV namespace binding name is `FORMS_STORAGE`
- Check Cloudflare KV dashboard to see if data is being stored
- View browser console when submitting forms

## 📧 Email Setup for Form Submissions

### Current Status
**Forms are currently NOT sending emails.** They collect data and show success messages, but emails need to be configured.

### Where Forms Go Now
All form submissions are logged to the console and can be viewed in:
- Cloudflare Pages Dashboard → Functions → Logs
- Browser Console (for testing)

### Form Endpoints:
1. **Tour Requests**: `/api/schedule-tour`
2. **Enrollment Applications**: `/api/enrollment-application` 
3. **Employment Applications**: `/api/employment-application`

### Email Setup Options

#### Option 1: Cloudflare Email Workers (Recommended - FREE)

**Step 1: Set up Email Routing**
1. Go to Cloudflare Dashboard → Email → Email Routing
2. Add your domain: `learnandgrowchildcarecenter.me`
3. Create destination address: `info@learnandgrowchildcarecenter.me`
4. Verify email ownership

**Step 2: Install MailChannels (Free Email Sending)**
```javascript
// Add to src/index.tsx after form endpoints
import { EmailMessage } from 'cloudflare:email';

app.post('/api/enrollment-application', async (c) => {
  const data = await c.req.json()
  
  // Send email via MailChannels (free on Cloudflare)
  const message = new EmailMessage(
    "noreply@learnandgrowchildcarecenter.me",
    "info@learnandgrowchildcarecenter.me",
    `New Enrollment Application: ${data.childFirstName} ${data.childLastName}`
  );
  
  message.setBody(\`
    New Enrollment Application Received
    
    Parent: \${data.parentFirstName} \${data.parentLastName}
    Email: \${data.parentEmail}
    Phone: \${data.parentPhone}
    Child: \${data.childFirstName} \${data.childLastName}
    Program: \${data.program}
    Start Date: \${data.startDate}
  \`);
  
  await message.send();
  
  return c.json({ success: true, message: 'Application received!' })
})
```

#### Option 2: SendGrid (Free: 100 emails/day)

**Setup:**
1. Sign up at sendgrid.com
2. Get API key
3. Add to Cloudflare environment variables:
   ```bash
   npx wrangler secret put SENDGRID_API_KEY
   ```
4. Install SendGrid in your code:
   ```bash
   npm install @sendgrid/mail
   ```
5. Update form handlers to use SendGrid

#### Option 3: Resend (Free: 3,000 emails/month)

**Setup:**
1. Sign up at resend.com
2. Verify your domain
3. Get API key
4. Add to environment:
   ```bash
   npx wrangler secret put RESEND_API_KEY
   ```

### Email Templates

When you set up email sending, emails will be sent to: **info@learnandgrowchildcarecenter.me**

Each form submission will include:
- **Tour Requests**: Parent info, child age, preferred date
- **Enrollment Applications**: Complete parent/child info, emergency contacts, medical info
- **Employment Applications**: Applicant details, position, qualifications, references

### Viewing Form Submissions (Current)

Until email is configured:
1. Go to Cloudflare Dashboard
2. Navigate to: Pages → learn-and-grow-childcare → Functions
3. Click "Logs" to see all form submissions
4. Data includes all form fields submitted

## How to Edit the Website

### 1. Editing Contact Information
All contact information is centralized in `src/index.tsx`. Search and replace:
- **Phone**: Search for `502-999-4143` and replace with your new number
- **Email**: Search for `info@learnandgrowchildcarecenter.me` and replace
- **Address**: Search for `4014 Bardstown Rd, Louisville, KY 40218-2631` and replace

**Important locations to update:**
- `/api/contact` endpoint (line ~14-20)
- Schema.org structured data (line ~54-68)
- Contact section (line ~1220-1242)
- Footer (line ~1396-1398)
- Form error messages (line ~1446)

### 2. Adding Your Own Videos
To replace the YouTube video placeholders:
1. Open `src/index.tsx`
2. Find the Video Testimonials section (around line ~1186)
3. Replace the YouTube embed URLs:
   ```html
   src="https://www.youtube.com/embed/YOUR_VIDEO_ID"
   ```
4. Update the video titles and descriptions below each iframe

**To get YouTube embed URL:**
- Go to your YouTube video
- Click "Share" → "Embed"
- Copy the URL from `src="..."` part

### 3. Changing Content and Text
All website content is in `src/index.tsx`. Look for these sections:
- **Hero Section**: Line ~330-388
- **Programs**: Line ~391-531
- **Safety**: Line ~533-654
- **Team Members**: Line ~769-852
- **Testimonials**: Line ~1093-1196

Simply edit the text between HTML tags.

### 4. Updating Images
Images use Unsplash URLs. To change:
1. Find the image tag (search for `images.unsplash.com`)
2. Replace with your own image URL or upload to `/public/static/` folder
3. Reference as `/static/your-image.jpg`

### 5. Deployment Workflow

**After making ANY changes:**

```bash
# 1. Build the project
npm run build

# 2. Commit your changes
git add .
git commit -m "describe your changes"

# 3. Push to GitHub
git push origin main

# 4. Deploy to Cloudflare Pages
export CLOUDFLARE_API_TOKEN="your_token"
export CLOUDFLARE_ACCOUNT_ID="your_account_id"
npx wrangler pages deploy dist --project-name learn-and-grow-childcare
```

### 6. Setting Up Custom Domain

To connect www.learnandgrowchildcarecenter.me:
1. Go to Cloudflare Dashboard → Pages → learn-and-grow-childcare
2. Click "Custom domains" tab
3. Click "Set up a custom domain"
4. Enter: `www.learnandgrowchildcarecenter.me`
5. Follow DNS setup instructions (add CNAME record)
6. Cloudflare will automatically handle SSL certificates

### 7. Connecting to GitHub Pages

Your repository is already connected! To manage:
- **GitHub**: https://github.com/marketingaipros/learn-and-grow
- In Cloudflare Pages settings, you can enable automatic deployments from GitHub
- Every push to `main` branch can trigger automatic deployment

### 8. Common Customizations

**Changing Colors:**
Edit the CSS variables in `<style>` section (line ~167-187):
```css
:root {
  --primary: #FF6B6B;    /* Main brand color */
  --secondary: #4ECDC4;   /* Secondary color */
  --accent: #FFE66D;      /* Accent highlights */
}
```

**Adding New Programs:**
Copy one of the program cards (line ~402-425) and modify the content.

**Modifying Forms:**
Form handling is in the JavaScript section (line ~1432-1449). Update API endpoints or add email integration.

## Support
For questions or issues:
- **Email**: info@learnandgrowchildcarecenter.me
- **Phone**: 502-999-4143
- **Address**: 4014 Bardstown Rd, Louisville, KY 40218-2631
- **Website**: https://www.learnandgrowchildcarecenter.me
- **GitHub**: https://github.com/marketingaipros/learn-and-grow
