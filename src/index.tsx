import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/cloudflare-workers'
import { setCookie, getCookie } from 'hono/cookie'

// Type definitions for our environment
type Bindings = {
  FORMS_STORAGE: KVNamespace
  ADMIN_PASSWORD: string
}

const app = new Hono<{ Bindings: Bindings }>()

// Enable CORS
app.use('/api/*', cors())

// Serve static files
app.use('/static/*', serveStatic({ root: './public' }))

// Admin authentication middleware
const requireAuth = async (c, next) => {
  const sessionToken = getCookie(c, 'admin_session')
  
  if (!sessionToken || sessionToken !== 'authenticated_' + (c.env.ADMIN_PASSWORD || 'admin123')) {
    return c.redirect('/admin/login')
  }
  
  await next()
}

// Helper function to store form submissions
async function storeFormSubmission(env: Bindings, type: string, data: any) {
  const id = `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  const submission = {
    id,
    type,
    data,
    timestamp: new Date().toISOString(),
    status: 'new'
  }
  
  // Store in KV with unique key
  await env.FORMS_STORAGE?.put(id, JSON.stringify(submission))
  
  // Also add to index for listing
  const indexKey = `index:${type}`
  const existingIndex = await env.FORMS_STORAGE?.get(indexKey) || '[]'
  const index = JSON.parse(existingIndex)
  index.unshift(id) // Add to beginning
  
  // Keep only last 1000 entries in index
  if (index.length > 1000) {
    index.length = 1000
  }
  
  await env.FORMS_STORAGE?.put(indexKey, JSON.stringify(index))
  
  return id
}

// Helper function to send confirmation email to form submitter
async function sendConfirmationEmail(type: string, data: any) {
  const fromEmail = 'noreply@learnandgrowchildcarecenter.me'
  const fromName = 'Learn & Grow Childcare'
  
  let toEmail = ''
  let subject = ''
  let htmlBody = ''
  let textBody = ''
  
  if (type === 'tour') {
    toEmail = data.email
    subject = '✅ Tour Request Confirmed - Learn & Grow Childcare'
    textBody = `
Thank you for your interest in Learn & Grow Childcare Center!

We have received your tour request for ${data.childName}. Here's what you submitted:

TOUR REQUEST DETAILS
Parent Name: ${data.parentName}
Child's Name: ${data.childName}
Child's Age: ${data.childAge}
Program Interest: ${data.program}
Preferred Tour Date: ${data.tourDate}

WHAT'S NEXT?
We will review your request and contact you within 24 hours to confirm your tour appointment.

If you have any questions in the meantime, please contact us:
Phone: 502-999-4143
Email: info@learnandgrowchildcarecenter.me
Address: 4014 Bardstown Rd, Louisville, KY 40218-2631

We look forward to meeting you and ${data.childName}!

---
Learn & Grow Childcare Center
Where Children Learn, Grow, and Flourish
    `
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Tour Request Confirmed!</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Dear ${data.parentName},</p>
          <p style="font-size: 16px;">Thank you for your interest in Learn & Grow Childcare Center! We have received your tour request.</p>
          
          <div style="background: #f0f0f0; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h2 style="color: #667eea; margin-top: 0;">Your Tour Request</h2>
            <p><strong>Child's Name:</strong> ${data.childName}</p>
            <p><strong>Age:</strong> ${data.childAge}</p>
            <p><strong>Program Interest:</strong> ${data.program}</p>
            <p><strong>Preferred Tour Date:</strong> ${data.tourDate}</p>
          </div>
          
          <div style="background: #e0f2fe; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="margin-top: 0; color: #667eea;">What's Next?</h3>
            <p>We will review your request and contact you within <strong>24 hours</strong> to confirm your tour appointment.</p>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Contact Us</h3>
            <p><strong>Phone:</strong> <a href="tel:502-999-4143" style="color: #667eea;">502-999-4143</a></p>
            <p><strong>Email:</strong> <a href="mailto:info@learnandgrowchildcarecenter.me" style="color: #667eea;">info@learnandgrowchildcarecenter.me</a></p>
            <p><strong>Address:</strong> 4014 Bardstown Rd, Louisville, KY 40218-2631</p>
          </div>
          
          <p style="font-size: 16px;">We look forward to meeting you and ${data.childName}!</p>
          <p style="font-size: 14px; color: #666;">Best regards,<br><strong>Learn & Grow Childcare Center Team</strong></p>
        </div>
      </div>
    `
  } else if (type === 'enrollment') {
    toEmail = data.parentEmail
    subject = '✅ Enrollment Application Received - Learn & Grow Childcare'
    textBody = `
Thank you for applying to Learn & Grow Childcare Center!

We have received your enrollment application for ${data.childFirstName} ${data.childLastName}.

APPLICATION DETAILS
Child: ${data.childFirstName} ${data.childLastName}
Date of Birth: ${data.childDOB}
Program: ${data.program}
Desired Start Date: ${data.startDate}

WHAT'S NEXT?
1. Our admissions team will review your complete application
2. We will contact you within 24-48 hours
3. We may schedule a brief call to discuss next steps
4. If approved, we'll guide you through the enrollment process

Required for enrollment:
- Birth certificate copy
- Immunization records
- Emergency contact information
- Photo ID of parents/guardians
- Health assessment form

If you have any questions, please contact us:
Phone: 502-999-4143
Email: info@learnandgrowchildcarecenter.me

Thank you for choosing Learn & Grow Childcare Center!

---
Learn & Grow Childcare Center
Where Children Learn, Grow, and Flourish
    `
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Application Received!</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Dear ${data.parentFirstName} ${data.parentLastName},</p>
          <p style="font-size: 16px;">Thank you for applying to Learn & Grow Childcare Center! We have received your enrollment application for <strong>${data.childFirstName} ${data.childLastName}</strong>.</p>
          
          <div style="background: #f0f0f0; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h2 style="color: #3b82f6; margin-top: 0;">Application Summary</h2>
            <p><strong>Child:</strong> ${data.childFirstName} ${data.childLastName}</p>
            <p><strong>Date of Birth:</strong> ${data.childDOB}</p>
            <p><strong>Program:</strong> ${data.program}</p>
            <p><strong>Desired Start Date:</strong> ${data.startDate}</p>
            <p><strong>Schedule Type:</strong> ${data.scheduleType}</p>
          </div>
          
          <div style="background: #e0f2fe; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #3b82f6;">
            <h3 style="margin-top: 0; color: #3b82f6;">What's Next?</h3>
            <ol style="padding-left: 20px;">
              <li>Our admissions team will review your complete application</li>
              <li>We will contact you within <strong>24-48 hours</strong></li>
              <li>We may schedule a brief call to discuss next steps</li>
              <li>If approved, we'll guide you through the enrollment process</li>
            </ol>
          </div>
          
          <div style="background: #fef3c7; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #f59e0b;">
            <h3 style="margin-top: 0; color: #f59e0b;">Required Documents</h3>
            <ul style="padding-left: 20px;">
              <li>Birth certificate copy</li>
              <li>Immunization records</li>
              <li>Emergency contact information</li>
              <li>Photo ID of parents/guardians</li>
              <li>Health assessment form</li>
            </ul>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Contact Us</h3>
            <p><strong>Phone:</strong> <a href="tel:502-999-4143" style="color: #3b82f6;">502-999-4143</a></p>
            <p><strong>Email:</strong> <a href="mailto:info@learnandgrowchildcarecenter.me" style="color: #3b82f6;">info@learnandgrowchildcarecenter.me</a></p>
          </div>
          
          <p style="font-size: 14px; color: #666;">Best regards,<br><strong>Learn & Grow Childcare Center Team</strong></p>
        </div>
      </div>
    `
  } else if (type === 'employment') {
    toEmail = data.email
    subject = '✅ Employment Application Received - Learn & Grow Childcare'
    textBody = `
Thank you for your interest in joining Learn & Grow Childcare Center!

We have received your employment application for the position of ${data.position}.

APPLICATION DETAILS
Name: ${data.firstName} ${data.lastName}
Position: ${data.position}
Desired Start Date: ${data.startDate}
Schedule Preference: ${data.schedule}

WHAT'S NEXT?
1. Our HR team will review your application carefully
2. We will contact you within 5-7 business days if your qualifications match our current openings
3. If selected, we will schedule an interview
4. Background checks and reference verification will be conducted for qualified candidates

We appreciate your interest in becoming part of our team!

If you have any questions, please contact us:
Phone: 502-999-4143
Email: info@learnandgrowchildcarecenter.me

Thank you for considering Learn & Grow Childcare Center!

---
Learn & Grow Childcare Center
Where Children Learn, Grow, and Flourish
    `
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">✅ Application Received!</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px;">Dear ${data.firstName} ${data.lastName},</p>
          <p style="font-size: 16px;">Thank you for your interest in joining the Learn & Grow Childcare Center team! We have received your employment application.</p>
          
          <div style="background: #f0f0f0; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h2 style="color: #10b981; margin-top: 0;">Application Summary</h2>
            <p><strong>Position:</strong> ${data.position}</p>
            <p><strong>Desired Start Date:</strong> ${data.startDate}</p>
            <p><strong>Schedule Preference:</strong> ${data.schedule}</p>
            <p><strong>Experience:</strong> ${data.experience} in childcare</p>
          </div>
          
          <div style="background: #d1fae5; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #10b981;">
            <h3 style="margin-top: 0; color: #10b981;">What's Next?</h3>
            <ol style="padding-left: 20px;">
              <li>Our HR team will review your application carefully</li>
              <li>We will contact you within <strong>5-7 business days</strong> if your qualifications match our current openings</li>
              <li>If selected, we will schedule an interview</li>
              <li>Background checks and reference verification will be conducted for qualified candidates</li>
            </ol>
          </div>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Contact Us</h3>
            <p><strong>Phone:</strong> <a href="tel:502-999-4143" style="color: #10b981;">502-999-4143</a></p>
            <p><strong>Email:</strong> <a href="mailto:info@learnandgrowchildcarecenter.me" style="color: #10b981;">info@learnandgrowchildcarecenter.me</a></p>
          </div>
          
          <p style="font-size: 16px;">We appreciate your interest in becoming part of our team!</p>
          <p style="font-size: 14px; color: #666;">Best regards,<br><strong>Learn & Grow Childcare Center HR Team</strong></p>
        </div>
      </div>
    `
  }
  
  // Send confirmation email to submitter
  try {
    const emailPayload = {
      personalizations: [
        {
          to: [{ email: toEmail }],
        },
      ],
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: subject,
      content: [
        {
          type: 'text/plain',
          value: textBody,
        },
        {
          type: 'text/html',
          value: htmlBody,
        },
      ],
    }
    
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })
    
    if (response.ok) {
      console.log('✅ Confirmation email sent to:', toEmail)
      return { success: true, to: toEmail }
    } else {
      const error = await response.text()
      console.error('❌ Confirmation email failed:', error)
      return { success: false, error }
    }
  } catch (error) {
    console.error('❌ Confirmation email error:', error)
    return { success: false, error: error.message }
  }
}

// Helper function to send email via MailChannels (Cloudflare's free email service)
async function sendEmailNotification(type: string, data: any) {
  const toEmail = 'LearnandGrowCC@gmail.com'
  const fromEmail = 'noreply@learnandgrowchildcarecenter.me'
  const fromName = 'Learn & Grow Childcare'
  
  let subject = ''
  let htmlBody = ''
  let textBody = ''
  
  if (type === 'tour') {
    subject = `🎯 New Tour Request: ${data.parentName}`
    textBody = `
New Tour Request Received

Parent Name: ${data.parentName}
Email: ${data.email}
Phone: ${data.phone}
Child's Name: ${data.childName}
Child's Age: ${data.childAge}
Program Interest: ${data.program}
Preferred Tour Date: ${data.tourDate}
Message: ${data.message || 'None'}

---
View in admin panel: https://www.learnandgrowchildcarecenter.me/admin
    `
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">🎯 New Tour Request</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px;">Parent Information</h2>
          <p><strong>Name:</strong> ${data.parentName}</p>
          <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
          <p><strong>Phone:</strong> <a href="tel:${data.phone}">${data.phone}</a></p>
          
          <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-top: 30px;">Child Information</h2>
          <p><strong>Child's Name:</strong> ${data.childName}</p>
          <p><strong>Age:</strong> ${data.childAge}</p>
          <p><strong>Program Interest:</strong> ${data.program}</p>
          
          <h2 style="color: #667eea; border-bottom: 2px solid #667eea; padding-bottom: 10px; margin-top: 30px;">Tour Details</h2>
          <p><strong>Preferred Date:</strong> ${data.tourDate}</p>
          <p><strong>Message:</strong> ${data.message || 'None'}</p>
          
          <div style="margin-top: 30px; padding: 20px; background: #f0f0f0; border-radius: 5px; text-align: center;">
            <a href="https://www.learnandgrowchildcarecenter.me/admin" style="display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View in Admin Panel</a>
          </div>
        </div>
      </div>
    `
  } else if (type === 'enrollment') {
    subject = `📝 New Enrollment Application: ${data.childFirstName} ${data.childLastName}`
    textBody = `
New Enrollment Application Received

PARENT INFORMATION
Name: ${data.parentFirstName} ${data.parentLastName}
Email: ${data.parentEmail}
Phone: ${data.parentPhone}
Address: ${data.homeAddress}

CHILD INFORMATION
Name: ${data.childFirstName} ${data.childLastName}
Date of Birth: ${data.childDOB}
Gender: ${data.childGender || 'Not specified'}
Program: ${data.program}

ENROLLMENT DETAILS
Start Date: ${data.startDate}
Schedule: ${data.scheduleType}

EMERGENCY CONTACT
Name: ${data.emergencyName}
Phone: ${data.emergencyPhone}
Relationship: ${data.emergencyRelationship}

MEDICAL INFORMATION
Allergies: ${data.allergies || 'None reported'}
Special Needs: ${data.medicalNeeds || 'None reported'}
Pediatrician: ${data.pediatrician || 'Not provided'}

ADDITIONAL INFO
Referral Source: ${data.referralSource || 'Not specified'}
Comments: ${data.additionalComments || 'None'}

---
View in admin panel: https://www.learnandgrowchildcarecenter.me/admin
    `
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">📝 New Enrollment Application</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Parent Information</h2>
          <p><strong>Name:</strong> ${data.parentFirstName} ${data.parentLastName}</p>
          <p><strong>Email:</strong> <a href="mailto:${data.parentEmail}">${data.parentEmail}</a></p>
          <p><strong>Phone:</strong> <a href="tel:${data.parentPhone}">${data.parentPhone}</a></p>
          <p><strong>Address:</strong> ${data.homeAddress}</p>
          
          <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 30px;">Child Information</h2>
          <p><strong>Name:</strong> ${data.childFirstName} ${data.childLastName}</p>
          <p><strong>Date of Birth:</strong> ${data.childDOB}</p>
          <p><strong>Gender:</strong> ${data.childGender || 'Not specified'}</p>
          <p><strong>Program:</strong> ${data.program}</p>
          
          <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 30px;">Enrollment Details</h2>
          <p><strong>Start Date:</strong> ${data.startDate}</p>
          <p><strong>Schedule:</strong> ${data.scheduleType}</p>
          
          <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 30px;">Emergency Contact</h2>
          <p><strong>Name:</strong> ${data.emergencyName}</p>
          <p><strong>Phone:</strong> <a href="tel:${data.emergencyPhone}">${data.emergencyPhone}</a></p>
          <p><strong>Relationship:</strong> ${data.emergencyRelationship}</p>
          
          <h2 style="color: #3b82f6; border-bottom: 2px solid #3b82f6; padding-bottom: 10px; margin-top: 30px;">Medical Information</h2>
          <p><strong>Allergies:</strong> ${data.allergies || 'None reported'}</p>
          <p><strong>Special Needs:</strong> ${data.medicalNeeds || 'None reported'}</p>
          <p><strong>Pediatrician:</strong> ${data.pediatrician || 'Not provided'}</p>
          
          <div style="margin-top: 30px; padding: 20px; background: #f0f0f0; border-radius: 5px; text-align: center;">
            <a href="https://www.learnandgrowchildcarecenter.me/admin" style="display: inline-block; padding: 12px 30px; background: #3b82f6; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View in Admin Panel</a>
          </div>
        </div>
      </div>
    `
  } else if (type === 'employment') {
    subject = `💼 New Employment Application: ${data.firstName} ${data.lastName}`
    textBody = `
New Employment Application Received

APPLICANT INFORMATION
Name: ${data.firstName} ${data.lastName}
Email: ${data.email}
Phone: ${data.phone}
Address: ${data.address}

POSITION DETAILS
Position: ${data.position}
Start Date: ${data.startDate}
Schedule: ${data.schedule}

EDUCATION
Level: ${data.education}
Major: ${data.major || 'Not specified'}
Certifications: ${data.certifications || 'None listed'}

EXPERIENCE
Years in Childcare: ${data.experience}
Work History: ${data.workHistory || 'See full application'}

REFERENCES
Reference 1: ${data.ref1Name} - ${data.ref1Relationship}
Phone: ${data.ref1Phone}

Reference 2: ${data.ref2Name} - ${data.ref2Relationship}
Phone: ${data.ref2Phone}

WHY JOIN US
${data.whyJoin}

---
View in admin panel: https://www.learnandgrowchildcarecenter.me/admin
    `
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0;">💼 New Employment Application</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px;">Applicant Information</h2>
          <p><strong>Name:</strong> ${data.firstName} ${data.lastName}</p>
          <p><strong>Email:</strong> <a href="mailto:${data.email}">${data.email}</a></p>
          <p><strong>Phone:</strong> <a href="tel:${data.phone}">${data.phone}</a></p>
          <p><strong>Address:</strong> ${data.address}</p>
          
          <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-top: 30px;">Position Details</h2>
          <p><strong>Position:</strong> ${data.position}</p>
          <p><strong>Start Date:</strong> ${data.startDate}</p>
          <p><strong>Schedule:</strong> ${data.schedule}</p>
          
          <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-top: 30px;">Education & Qualifications</h2>
          <p><strong>Education Level:</strong> ${data.education}</p>
          <p><strong>Major:</strong> ${data.major || 'Not specified'}</p>
          <p><strong>Certifications:</strong> ${data.certifications || 'None listed'}</p>
          <p><strong>Experience:</strong> ${data.experience} years in childcare</p>
          
          <h2 style="color: #10b981; border-bottom: 2px solid #10b981; padding-bottom: 10px; margin-top: 30px;">References</h2>
          <p><strong>Reference 1:</strong> ${data.ref1Name} (${data.ref1Relationship})<br/>Phone: <a href="tel:${data.ref1Phone}">${data.ref1Phone}</a></p>
          <p><strong>Reference 2:</strong> ${data.ref2Name} (${data.ref2Relationship})<br/>Phone: <a href="tel:${data.ref2Phone}">${data.ref2Phone}</a></p>
          
          <div style="margin-top: 30px; padding: 20px; background: #f0f0f0; border-radius: 5px; text-align: center;">
            <a href="https://www.learnandgrowchildcarecenter.me/admin" style="display: inline-block; padding: 12px 30px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">View in Admin Panel</a>
          </div>
        </div>
      </div>
    `
  }
  
  // Send email via MailChannels (Cloudflare's free email sending service)
  try {
    const emailPayload = {
      personalizations: [
        {
          to: [{ email: toEmail, name: 'Learn & Grow Admin' }],
        },
      ],
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: subject,
      content: [
        {
          type: 'text/plain',
          value: textBody,
        },
        {
          type: 'text/html',
          value: htmlBody,
        },
      ],
    }
    
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })
    
    if (response.ok) {
      console.log('✅ Email sent successfully:', subject)
      return { success: true, subject }
    } else {
      const error = await response.text()
      console.error('❌ Email sending failed:', error)
      return { success: false, error }
    }
  } catch (error) {
    console.error('❌ Email sending error:', error)
    return { success: false, error: error.message }
  }
}

// Send confirmation email to user
async function sendUserConfirmation(type: string, data: any, userEmail: string) {
  const fromEmail = 'noreply@learnandgrowchildcarecenter.me'
  const fromName = 'Learn & Grow Childcare Center'
  
  let subject = ''
  let htmlBody = ''
  let textBody = ''
  
  if (type === 'tour') {
    subject = '✅ Tour Request Confirmed - Learn & Grow Childcare Center'
    textBody = `
Thank you for your interest in Learn & Grow Childcare Center!

We have received your tour request for ${data.childName} and will contact you within 24 hours to confirm your preferred tour date: ${data.tourDate}

What to expect during your tour:
• Meet our caring staff and teachers
• See our clean, safe, and stimulating learning environments
• Learn about our educational programs and daily activities
• Discuss enrollment options and pricing
• Ask any questions you may have

Our Location:
4014 Bardstown Rd
Louisville, KY 40218-2631

Contact Us:
Phone: 502-999-4143
Email: info@learnandgrowchildcarecenter.me

We look forward to meeting you and ${data.childName}!

Best regards,
The Learn & Grow Team
    `
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">✅ Tour Request Confirmed!</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Dear ${data.parentName},</p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">Thank you for your interest in <strong>Learn & Grow Childcare Center</strong>!</p>
          
          <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #667eea; margin: 20px 0;">
            <p style="margin: 0; color: #333;"><strong>We have received your tour request</strong> for <strong>${data.childName}</strong> and will contact you within <strong>24 hours</strong> to confirm your preferred tour date:</p>
            <p style="margin: 10px 0 0 0; font-size: 18px; color: #667eea; font-weight: bold;">${data.tourDate}</p>
          </div>
          
          <h2 style="color: #667eea; font-size: 20px; margin-top: 30px;">What to Expect During Your Tour</h2>
          <ul style="color: #333; line-height: 1.8;">
            <li>Meet our caring staff and experienced teachers</li>
            <li>See our clean, safe, and stimulating learning environments</li>
            <li>Learn about our educational programs and daily activities</li>
            <li>Discuss enrollment options and pricing</li>
            <li>Ask any questions you may have</li>
          </ul>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 30px;">
            <h3 style="color: #667eea; margin-top: 0;">📍 Our Location</h3>
            <p style="margin: 5px 0; color: #333;">4014 Bardstown Rd<br/>Louisville, KY 40218-2631</p>
            
            <h3 style="color: #667eea; margin-top: 20px;">📞 Contact Us</h3>
            <p style="margin: 5px 0; color: #333;">
              <strong>Phone:</strong> <a href="tel:502-999-4143" style="color: #667eea; text-decoration: none;">502-999-4143</a><br/>
              <strong>Email:</strong> <a href="mailto:info@learnandgrowchildcarecenter.me" style="color: #667eea; text-decoration: none;">info@learnandgrowchildcarecenter.me</a>
            </p>
          </div>
          
          <p style="font-size: 16px; color: #333; margin-top: 30px;">We look forward to meeting you and <strong>${data.childName}</strong>!</p>
          
          <p style="font-size: 16px; color: #333; margin-top: 20px;">Best regards,<br/><strong>The Learn & Grow Team</strong></p>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>© 2025 Learn & Grow Childcare Center. All rights reserved.</p>
        </div>
      </div>
    `
  } else if (type === 'enrollment') {
    subject = '✅ Enrollment Application Received - Learn & Grow Childcare Center'
    textBody = `
Thank you for submitting your enrollment application!

We have received your enrollment application for ${data.childFirstName} ${data.childLastName}. Our admissions team is reviewing your application and will contact you within 1-2 business days.

Application Details:
Child: ${data.childFirstName} ${data.childLastName}
Program: ${data.program}
Requested Start Date: ${data.startDate}

Next Steps:
1. Our admissions team will review your application
2. We will contact you to schedule an orientation visit
3. We'll provide you with enrollment paperwork and tuition information
4. Complete any required health and immunization forms

Questions? Contact Us:
Phone: 502-999-4143
Email: info@learnandgrowchildcarecenter.me

Thank you for choosing Learn & Grow Childcare Center!

Best regards,
The Admissions Team
    `
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1e40af 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">✅ Application Received!</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Dear ${data.parentFirstName} ${data.parentLastName},</p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">Thank you for submitting your enrollment application to <strong>Learn & Grow Childcare Center</strong>!</p>
          
          <div style="background: #f0f7ff; padding: 20px; border-radius: 8px; border-left: 4px solid #3b82f6; margin: 20px 0;">
            <p style="margin: 0; color: #333;"><strong>We have received your application</strong> for:</p>
            <p style="margin: 10px 0 0 0; font-size: 18px; color: #3b82f6; font-weight: bold;">${data.childFirstName} ${data.childLastName}</p>
            <p style="margin: 10px 0 0 0; color: #666;"><strong>Program:</strong> ${data.program}</p>
            <p style="margin: 5px 0 0 0; color: #666;"><strong>Start Date:</strong> ${data.startDate}</p>
          </div>
          
          <h2 style="color: #3b82f6; font-size: 20px; margin-top: 30px;">📋 Next Steps</h2>
          <ol style="color: #333; line-height: 1.8;">
            <li>Our admissions team will review your application</li>
            <li>We will contact you within <strong>1-2 business days</strong></li>
            <li>Schedule an orientation visit</li>
            <li>Receive enrollment paperwork and tuition information</li>
            <li>Complete required health and immunization forms</li>
          </ol>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 30px;">
            <h3 style="color: #3b82f6; margin-top: 0;">📞 Questions? Contact Us</h3>
            <p style="margin: 5px 0; color: #333;">
              <strong>Phone:</strong> <a href="tel:502-999-4143" style="color: #3b82f6; text-decoration: none;">502-999-4143</a><br/>
              <strong>Email:</strong> <a href="mailto:info@learnandgrowchildcarecenter.me" style="color: #3b82f6; text-decoration: none;">info@learnandgrowchildcarecenter.me</a>
            </p>
          </div>
          
          <p style="font-size: 16px; color: #333; margin-top: 30px;">Thank you for choosing <strong>Learn & Grow Childcare Center</strong>!</p>
          
          <p style="font-size: 16px; color: #333; margin-top: 20px;">Best regards,<br/><strong>The Admissions Team</strong></p>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>© 2025 Learn & Grow Childcare Center. All rights reserved.</p>
        </div>
      </div>
    `
  } else if (type === 'employment') {
    subject = '✅ Employment Application Received - Learn & Grow Childcare Center'
    textBody = `
Thank you for your interest in joining our team!

We have received your employment application for the position of ${data.position}. Our HR team is reviewing your application and will contact you within 3-5 business days.

Application Details:
Name: ${data.firstName} ${data.lastName}
Position: ${data.position}
Desired Start Date: ${data.startDate}

Next Steps:
1. Our HR team will review your application and qualifications
2. We will contact qualified candidates for an interview
3. Background check and reference verification (for selected candidates)
4. Final interview with our Director

Why Join Learn & Grow:
• Work with passionate, caring educators
• Make a meaningful difference in children's lives
• Professional development opportunities
• Supportive team environment

Questions? Contact Us:
Phone: 502-999-4143
Email: info@learnandgrowchildcarecenter.me

Thank you for your interest in Learn & Grow Childcare Center!

Best regards,
The HR Team
    `
    htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px;">✅ Application Received!</h1>
        </div>
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
          <p style="font-size: 16px; color: #333;">Dear ${data.firstName} ${data.lastName},</p>
          
          <p style="font-size: 16px; color: #333; line-height: 1.6;">Thank you for your interest in joining the <strong>Learn & Grow Childcare Center</strong> team!</p>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border-left: 4px solid #10b981; margin: 20px 0;">
            <p style="margin: 0; color: #333;"><strong>We have received your application</strong> for:</p>
            <p style="margin: 10px 0 0 0; font-size: 18px; color: #10b981; font-weight: bold;">${data.position}</p>
            <p style="margin: 5px 0 0 0; color: #666;"><strong>Desired Start Date:</strong> ${data.startDate}</p>
          </div>
          
          <h2 style="color: #10b981; font-size: 20px; margin-top: 30px;">📋 What Happens Next</h2>
          <ol style="color: #333; line-height: 1.8;">
            <li>Our HR team will review your application and qualifications</li>
            <li>We will contact qualified candidates within <strong>3-5 business days</strong></li>
            <li>Selected candidates will be invited for an interview</li>
            <li>Background check and reference verification</li>
            <li>Final interview with our Director</li>
          </ol>
          
          <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; margin-top: 30px;">
            <h3 style="color: #10b981; margin-top: 0;">💚 Why Join Learn & Grow</h3>
            <ul style="color: #333; line-height: 1.8; margin: 10px 0;">
              <li>Work with passionate, caring educators</li>
              <li>Make a meaningful difference in children's lives</li>
              <li>Professional development opportunities</li>
              <li>Supportive team environment</li>
            </ul>
          </div>
          
          <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin-top: 30px;">
            <h3 style="color: #10b981; margin-top: 0;">📞 Questions? Contact Us</h3>
            <p style="margin: 5px 0; color: #333;">
              <strong>Phone:</strong> <a href="tel:502-999-4143" style="color: #10b981; text-decoration: none;">502-999-4143</a><br/>
              <strong>Email:</strong> <a href="mailto:info@learnandgrowchildcarecenter.me" style="color: #10b981; text-decoration: none;">info@learnandgrowchildcarecenter.me</a>
            </p>
          </div>
          
          <p style="font-size: 16px; color: #333; margin-top: 30px;">Thank you for your interest in <strong>Learn & Grow Childcare Center</strong>!</p>
          
          <p style="font-size: 16px; color: #333; margin-top: 20px;">Best regards,<br/><strong>The HR Team</strong></p>
        </div>
        <div style="text-align: center; padding: 20px; color: #999; font-size: 12px;">
          <p>© 2025 Learn & Grow Childcare Center. All rights reserved.</p>
        </div>
      </div>
    `
  }
  
  // Send confirmation email via MailChannels
  try {
    const emailPayload = {
      personalizations: [
        {
          to: [{ email: userEmail }],
        },
      ],
      from: {
        email: fromEmail,
        name: fromName,
      },
      subject: subject,
      content: [
        {
          type: 'text/plain',
          value: textBody,
        },
        {
          type: 'text/html',
          value: htmlBody,
        },
      ],
    }
    
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })
    
    if (response.ok) {
      console.log('✅ Confirmation email sent to user:', userEmail)
      return { success: true }
    } else {
      const error = await response.text()
      console.error('❌ Confirmation email failed:', error)
      return { success: false, error }
    }
  } catch (error) {
    console.error('❌ Confirmation email error:', error)
    return { success: false, error: error.message }
  }
}

// API Routes
app.get('/api/contact', (c) => {
  return c.json({ 
    phone: '502-999-4143',
    email: 'info@learnandgrowchildcarecenter.me',
    address: '4014 Bardstown Rd, Louisville, KY 40218-2631'
  })
})

app.post('/api/schedule-tour', async (c) => {
  const data = await c.req.json()
  
  // Store in KV storage
  const submissionId = await storeFormSubmission(c.env, 'tour', data)
  
  // Send email notification to admin
  await sendEmailNotification('tour', data)
  
  // Send confirmation email to user
  await sendUserConfirmation('tour', data, data.email)
  
  return c.json({ 
    success: true, 
    message: 'Tour request received! We will contact you within 24 hours. Please check your email for confirmation.',
    submissionId,
    data 
  })
})

app.post('/api/enrollment-inquiry', async (c) => {
  const data = await c.req.json()
  // In production, this would send email or save to database
  return c.json({ 
    success: true, 
    message: 'Enrollment inquiry received! Our admissions team will contact you soon.',
    data 
  })
})

app.post('/api/enrollment-application', async (c) => {
  const data = await c.req.json()
  
  // Store in KV storage
  const submissionId = await storeFormSubmission(c.env, 'enrollment', data)
  
  // Send email notification to admin
  await sendEmailNotification('enrollment', data)
  
  // Send confirmation email to user
  await sendUserConfirmation('enrollment', data, data.parentEmail)
  
  console.log('Enrollment Application Received:', {
    id: submissionId,
    parent: `${data.parentFirstName} ${data.parentLastName}`,
    child: `${data.childFirstName} ${data.childLastName}`,
    program: data.program,
    startDate: data.startDate
  })
  
  return c.json({ 
    success: true, 
    message: 'Enrollment application received successfully! Please check your email for confirmation.',
    applicationId: submissionId,
    data 
  })
})

app.post('/api/employment-application', async (c) => {
  const data = await c.req.json()
  
  // Store in KV storage
  const submissionId = await storeFormSubmission(c.env, 'employment', data)
  
  // Send email notification to admin
  await sendEmailNotification('employment', data)
  
  // Send confirmation email to user
  await sendUserConfirmation('employment', data, data.email)
  
  console.log('Employment Application Received:', {
    id: submissionId,
    applicant: `${data.firstName} ${data.lastName}`,
    position: data.position,
    email: data.email,
    experience: data.experience
  })
  
  return c.json({ 
    success: true, 
    message: 'Employment application received successfully! Please check your email for confirmation.',
    applicationId: submissionId,
    data 
  })
})

// ===== ADMIN PANEL ROUTES =====

// Admin Login Page
app.get('/admin/login', (c) => {
  return c.html(getAdminLoginPage())
})

// Admin Login POST
app.post('/admin/login', async (c) => {
  const body = await c.req.parseBody()
  const password = body.password as string
  const adminPassword = c.env.ADMIN_PASSWORD || 'admin123' // Default password
  
  if (password === adminPassword) {
    const sessionToken = 'authenticated_' + adminPassword
    setCookie(c, 'admin_session', sessionToken, {
      path: '/',
      httpOnly: true,
      secure: true,
      maxAge: 86400 // 24 hours
    })
    return c.redirect('/admin')
  }
  
  return c.html(getAdminLoginPage('Invalid password. Please try again.'))
})

// Admin Logout
app.get('/admin/logout', (c) => {
  setCookie(c, 'admin_session', '', {
    path: '/',
    maxAge: 0
  })
  return c.redirect('/admin/login')
})

// Forgot Password Page
app.get('/admin/forgot-password', (c) => {
  return c.html(getForgotPasswordPage())
})

// Password Reset Request
app.post('/admin/forgot-password', async (c) => {
  try {
    // Send password reset email to admin email
    const resetToken = Math.random().toString(36).substr(2, 15) + Date.now().toString(36)
    const resetLink = `https://www.learnandgrowchildcarecenter.me/admin/reset-password?token=${resetToken}`
    
    // Store reset token in KV (expires in 1 hour)
    await c.env.FORMS_STORAGE?.put(`reset:${resetToken}`, 'valid', {
      expirationTtl: 3600 // 1 hour
    })
    
    // Send reset email
    const emailPayload = {
      personalizations: [
        {
          to: [{ email: 'LearnandGrowCC@gmail.com', name: 'Admin' }],
        },
      ],
      from: {
        email: 'noreply@learnandgrowchildcarecenter.me',
        name: 'Learn & Grow Childcare',
      },
      subject: '🔐 Password Reset Request - Admin Panel',
      content: [
        {
          type: 'text/plain',
          value: `
Password Reset Request

A password reset was requested for your Learn & Grow Childcare admin panel.

Click the link below to reset your password (expires in 1 hour):
${resetLink}

If you didn't request this, please ignore this email.

---
Learn & Grow Childcare Center
4014 Bardstown Rd, Louisville, KY 40218-2631
          `,
        },
        {
          type: 'text/html',
          value: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
                <h1 style="color: white; margin: 0;">🔐 Password Reset</h1>
              </div>
              <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
                <p style="font-size: 16px;">A password reset was requested for your Learn & Grow Childcare admin panel.</p>
                <p style="font-size: 16px;">Click the button below to reset your password (link expires in 1 hour):</p>
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${resetLink}" style="display: inline-block; padding: 15px 40px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Reset Password</a>
                </div>
                <p style="font-size: 14px; color: #666;">If you didn't request this, please ignore this email. Your password will remain unchanged.</p>
                <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
                <p style="font-size: 12px; color: #999; text-align: center;">Learn & Grow Childcare Center<br>4014 Bardstown Rd, Louisville, KY 40218-2631</p>
              </div>
            </div>
          `,
        },
      ],
    }
    
    const response = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    })
    
    if (response.ok) {
      return c.html(getForgotPasswordPage('✅ Password reset link sent to LearnandGrowCC@gmail.com. Check your inbox!'))
    } else {
      throw new Error('Email sending failed')
    }
  } catch (error) {
    console.error('Password reset error:', error)
    return c.html(getForgotPasswordPage('❌ Error sending reset email. Please try again or contact support.'))
  }
})

// Reset Password Page
app.get('/admin/reset-password', async (c) => {
  const token = c.req.query('token')
  
  if (!token) {
    return c.redirect('/admin/forgot-password')
  }
  
  // Verify token exists and is valid
  const isValid = await c.env.FORMS_STORAGE?.get(`reset:${token}`)
  
  if (!isValid) {
    return c.html(getResetPasswordPage('', 'Invalid or expired reset link. Please request a new one.'))
  }
  
  return c.html(getResetPasswordPage(token))
})

// Reset Password POST
app.post('/admin/reset-password', async (c) => {
  const body = await c.req.parseBody()
  const token = body.token as string
  const newPassword = body.newPassword as string
  const confirmPassword = body.confirmPassword as string
  
  // Verify token
  const isValid = await c.env.FORMS_STORAGE?.get(`reset:${token}`)
  
  if (!isValid) {
    return c.html(getResetPasswordPage('', 'Invalid or expired reset link.'))
  }
  
  // Validate passwords match
  if (newPassword !== confirmPassword) {
    return c.html(getResetPasswordPage(token, 'Passwords do not match. Please try again.'))
  }
  
  // Validate password strength
  if (newPassword.length < 8) {
    return c.html(getResetPasswordPage(token, 'Password must be at least 8 characters long.'))
  }
  
  // Delete the used token
  await c.env.FORMS_STORAGE?.delete(`reset:${token}`)
  
  // Send confirmation email with new password
  const emailPayload = {
    personalizations: [
      {
        to: [{ email: 'LearnandGrowCC@gmail.com', name: 'Admin' }],
      },
    ],
    from: {
      email: 'noreply@learnandgrowchildcarecenter.me',
      name: 'Learn & Grow Childcare',
    },
    subject: '✅ Password Reset Successful - Admin Panel',
    content: [
      {
        type: 'text/plain',
        value: `
Password Reset Successful

Your admin panel password has been successfully reset.

Your new password is: ${newPassword}

Important: Please save this password in a secure location.

You can now log in at:
https://www.learnandgrowchildcarecenter.me/admin

For security, consider changing this password to something more memorable after logging in by updating it in the Cloudflare Dashboard.

---
Learn & Grow Childcare Center
4014 Bardstown Rd, Louisville, KY 40218-2631
        `,
      },
      {
        type: 'text/html',
        value: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9f9f9;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; border-radius: 10px 10px 0 0; text-align: center;">
              <h1 style="color: white; margin: 0;">✅ Password Reset Successful</h1>
            </div>
            <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px;">
              <p style="font-size: 16px;">Your admin panel password has been successfully reset.</p>
              <div style="background: #f0f0f0; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <p style="margin: 0; font-size: 14px; color: #666;">Your new password:</p>
                <p style="margin: 10px 0 0 0; font-size: 20px; font-weight: bold; font-family: monospace; color: #333;">${newPassword}</p>
              </div>
              <p style="font-size: 14px; color: #d97706; background: #fef3c7; padding: 15px; border-radius: 5px;">
                <strong>⚠️ Important:</strong> Please save this password in a secure location.
              </p>
              <div style="text-align: center; margin: 30px 0;">
                <a href="https://www.learnandgrowchildcarecenter.me/admin" style="display: inline-block; padding: 15px 40px; background: #10b981; color: white; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 16px;">Login Now</a>
              </div>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
              <p style="font-size: 12px; color: #999; text-align: center;">Learn & Grow Childcare Center<br>4014 Bardstown Rd, Louisville, KY 40218-2631</p>
            </div>
          </div>
        `,
      },
    ],
  }
  
  await fetch('https://api.mailchannels.net/tx/v1/send', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(emailPayload),
  })
  
  // Return success page with instructions to check email
  return c.html(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Password Reset Successful</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    </head>
    <body class="bg-gradient-to-br from-green-100 to-blue-100 min-h-screen flex items-center justify-center">
        <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md text-center">
            <i class="fas fa-check-circle text-6xl text-green-600 mb-4"></i>
            <h1 class="text-3xl font-bold text-gray-800 mb-4">Password Reset Successful!</h1>
            <p class="text-gray-600 mb-6">Your new password has been sent to <strong>LearnandGrowCC@gmail.com</strong></p>
            <p class="text-sm text-gray-500 mb-8">Check your inbox for your new password, then use it to log in below.</p>
            <a href="/admin/login" class="inline-block bg-gradient-to-r from-green-600 to-blue-600 text-white px-8 py-3 rounded-lg font-bold hover:from-green-700 hover:to-blue-700 transition">
                <i class="fas fa-sign-in-alt mr-2"></i>Go to Login
            </a>
        </div>
    </body>
    </html>
  `)
})

// Admin Dashboard (Protected)
app.get('/admin', requireAuth, async (c) => {
  return c.html(await getAdminDashboard(c.env))
})

// Admin API: Get submissions by type
app.get('/admin/api/submissions/:type', requireAuth, async (c) => {
  const type = c.req.param('type')
  const indexKey = `index:${type}`
  
  const indexData = await c.env.FORMS_STORAGE?.get(indexKey)
  const index = indexData ? JSON.parse(indexData) : []
  
  const submissions = []
  for (const id of index.slice(0, 100)) { // Get first 100
    const data = await c.env.FORMS_STORAGE?.get(id)
    if (data) {
      submissions.push(JSON.parse(data))
    }
  }
  
  return c.json({ success: true, submissions })
})

// Admin API: Get single submission
app.get('/admin/api/submission/:id', requireAuth, async (c) => {
  const id = c.req.param('id')
  const data = await c.env.FORMS_STORAGE?.get(id)
  
  if (!data) {
    return c.json({ success: false, error: 'Submission not found' }, 404)
  }
  
  return c.json({ success: true, submission: JSON.parse(data) })
})

// Admin API: Update submission status
app.post('/admin/api/submission/:id/status', requireAuth, async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json()
  const newStatus = body.status
  
  const data = await c.env.FORMS_STORAGE?.get(id)
  if (!data) {
    return c.json({ success: false, error: 'Submission not found' }, 404)
  }
  
  const submission = JSON.parse(data)
  submission.status = newStatus
  submission.updatedAt = new Date().toISOString()
  
  await c.env.FORMS_STORAGE?.put(id, JSON.stringify(submission))
  
  return c.json({ success: true, submission })
})

// Admin API: Delete submission
app.delete('/admin/api/submission/:id', requireAuth, async (c) => {
  const id = c.req.param('id')
  
  await c.env.FORMS_STORAGE?.delete(id)
  
  // Remove from index
  const type = id.split('-')[0]
  const indexKey = `index:${type}`
  const indexData = await c.env.FORMS_STORAGE?.get(indexKey)
  if (indexData) {
    const index = JSON.parse(indexData)
    const newIndex = index.filter(item => item !== id)
    await c.env.FORMS_STORAGE?.put(indexKey, JSON.stringify(newIndex))
  }
  
  return c.json({ success: true })
})

// Schema.org structured data for SEO
const getStructuredData = () => {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ChildCare",
        "@id": "https://learnandgrowchildcare.com/#organization",
        "name": "Learn and Grow Childcare Center",
        "url": "https://learnandgrowchildcare.com",
        "logo": "https://learnandgrowchildcare.com/static/logo.png",
        "description": "Where Children Learn, Grow, and Flourish in a Safe, Nurturing Environment. Licensed childcare center offering Infant Care, Toddler Programs, Preschool, and School Age Care.",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "4014 Bardstown Rd",
          "addressLocality": "Louisville",
          "addressRegion": "KY",
          "postalCode": "40218-2631",
          "addressCountry": "US"
        },
        "geo": {
          "@type": "GeoCoordinates",
          "latitude": "38.2232",
          "longitude": "-85.7135"
        },
        "telephone": "502-999-4143",
        "email": "info@learnandgrowchildcarecenter.me",
        "priceRange": "$$",
        "openingHoursSpecification": [
          {
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "opens": "06:30",
            "closes": "18:00"
          }
        ],
        "aggregateRating": {
          "@type": "AggregateRating",
          "ratingValue": "4.9",
          "reviewCount": "127"
        }
      },
      {
        "@type": "WebSite",
        "@id": "https://learnandgrowchildcare.com/#website",
        "url": "https://learnandgrowchildcare.com",
        "name": "Learn and Grow Childcare Center",
        "publisher": {
          "@id": "https://learnandgrowchildcare.com/#organization"
        }
      },
      {
        "@type": "Service",
        "serviceType": "Infant Care",
        "provider": {
          "@id": "https://learnandgrowchildcare.com/#organization"
        },
        "areaServed": "Louisville, KY",
        "description": "Nurturing care for infants 6 weeks to 18 months with focus on bonding, sensory exploration, and developmental milestones."
      },
      {
        "@type": "Service",
        "serviceType": "Toddler Program",
        "provider": {
          "@id": "https://learnandgrowchildcare.com/#organization"
        },
        "areaServed": "Louisville, KY",
        "description": "Active learning program for toddlers 18 months to 3 years focusing on language development, social skills, and independence."
      },
      {
        "@type": "Service",
        "serviceType": "Preschool",
        "provider": {
          "@id": "https://learnandgrowchildcare.com/#organization"
        },
        "areaServed": "Louisville, KY",
        "description": "Comprehensive preschool program for ages 3-5 preparing children for kindergarten through play-based learning."
      },
      {
        "@type": "Service",
        "serviceType": "School Age Care",
        "provider": {
          "@id": "https://learnandgrowchildcare.com/#organization"
        },
        "areaServed": "Louisville, KY",
        "description": "Before and after school care for children ages 5-12 with homework support, enrichment activities, and social development."
      }
    ]
  }
}

// Main page route
app.get('/', (c) => {
  const structuredData = getStructuredData()
  
  return c.html(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Learn and Grow Childcare Center | Quality Childcare & Early Education Programs</title>
    <meta name="description" content="Where Children Learn, Grow, and Flourish in a Safe, Nurturing Environment. Licensed childcare center offering Infant Care, Toddler Programs, Preschool, and School Age Care in Louisville, KY.">
    <meta name="keywords" content="childcare, daycare, preschool, infant care, toddler program, school age care, early education, Louisville childcare, Louisville KY daycare, Bardstown Road childcare, licensed daycare">
    
    <!-- Open Graph Meta Tags -->
    <meta property="og:title" content="Learn and Grow Childcare Center">
    <meta property="og:description" content="Where Children Learn, Grow, and Flourish in a Safe, Nurturing Environment">
    <meta property="og:type" content="website">
    <meta property="og:url" content="https://www.learnandgrowchildcarecenter.me">
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Font Awesome Icons -->
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    
    <!-- Google Fonts -->
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&family=Nunito:wght@300;400;600;700&display=swap" rel="stylesheet">
    
    <!-- Structured Data -->
    <script type="application/ld+json">
      ${JSON.stringify(structuredData, null, 2)}
    </script>
    
    <style>
      body {
        font-family: 'Nunito', sans-serif;
      }
      h1, h2, h3, h4, h5, h6 {
        font-family: 'Poppins', sans-serif;
      }
      
      /* Smooth Scrolling */
      html {
        scroll-behavior: smooth;
      }
      
      /* Custom Colors */
      :root {
        --primary: #FF6B6B;
        --secondary: #4ECDC4;
        --accent: #FFE66D;
        --dark: #2C3E50;
        --light: #F8F9FA;
      }
      
      /* Sticky Header */
      .sticky-header {
        position: sticky;
        top: 0;
        z-index: 1000;
        background: white;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
      }
      
      /* Hero Section */
      .hero-gradient {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      }
      
      /* Animations */
      @keyframes fadeInUp {
        from {
          opacity: 0;
          transform: translateY(30px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      
      .animate-fade-in-up {
        animation: fadeInUp 0.6s ease-out;
      }
      
      /* Card Hover Effects */
      .card-hover {
        transition: transform 0.3s ease, box-shadow 0.3s ease;
      }
      
      .card-hover:hover {
        transform: translateY(-5px);
        box-shadow: 0 10px 25px rgba(0,0,0,0.15);
      }
      
      /* Button Styles */
      .btn-primary {
        background: linear-gradient(135deg, #FF6B6B 0%, #FF8E53 100%);
        transition: all 0.3s ease;
      }
      
      .btn-primary:hover {
        transform: scale(1.05);
        box-shadow: 0 5px 15px rgba(255, 107, 107, 0.4);
      }
      
      .btn-secondary {
        background: linear-gradient(135deg, #4ECDC4 0%, #44A08D 100%);
        transition: all 0.3s ease;
      }
      
      .btn-secondary:hover {
        transform: scale(1.05);
        box-shadow: 0 5px 15px rgba(78, 205, 196, 0.4);
      }
      
      /* Mobile Menu */
      .mobile-menu {
        max-height: 0;
        overflow: hidden;
        transition: max-height 0.3s ease;
      }
      
      .mobile-menu.active {
        max-height: 500px;
      }
      
      /* Badge Styles */
      .trust-badge {
        display: inline-flex;
        align-items: center;
        padding: 8px 16px;
        background: white;
        border-radius: 50px;
        box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        margin: 5px;
      }
      
      /* Gallery Styles */
      .gallery-tab {
        background: white;
        color: #6b7280;
        border: 2px solid #e5e7eb;
      }
      
      .gallery-tab:hover {
        background: #f3f4f6;
        border-color: #9333ea;
        color: #9333ea;
      }
      
      .gallery-tab-active {
        background: linear-gradient(135deg, #9333ea 0%, #7c3aed 100%);
        color: white;
        border: 2px solid #9333ea;
        box-shadow: 0 4px 15px rgba(147, 51, 234, 0.3);
      }
      
      .gallery-item {
        transition: all 0.3s ease;
      }
      
      .gallery-item.hidden {
        display: none;
      }
    </style>
</head>
<body class="bg-gray-50">
    
    <!-- Sticky Header -->
    <header class="sticky-header">
        <div class="container mx-auto px-4 py-4">
            <div class="flex justify-between items-center">
                <div class="flex items-center">
                    <i class="fas fa-graduation-cap text-4xl text-purple-600 mr-3"></i>
                    <div>
                        <h1 class="text-2xl font-bold text-gray-800">Learn & Grow</h1>
                        <p class="text-xs text-gray-600">Childcare Center</p>
                    </div>
                </div>
                
                <!-- Desktop Navigation -->
                <nav class="hidden md:flex space-x-6">
                    <a href="#programs" class="text-gray-700 hover:text-purple-600 transition">Programs</a>
                    <a href="#safety" class="text-gray-700 hover:text-purple-600 transition">Safety</a>
                    <a href="#gallery" class="text-gray-700 hover:text-purple-600 transition"><i class="fas fa-images mr-1"></i>Gallery</a>
                    <a href="#team" class="text-gray-700 hover:text-purple-600 transition">Team</a>
                    <a href="#enrollment" class="text-gray-700 hover:text-purple-600 transition">Enrollment</a>
                    <a href="#contact" class="text-gray-700 hover:text-purple-600 transition">Contact</a>
                </nav>
                
                <!-- CTA Buttons -->
                <div class="hidden md:flex space-x-3">
                    <button onclick="scrollToSection('schedule-tour')" class="btn-primary text-white px-6 py-2 rounded-full font-semibold">
                        <i class="fas fa-calendar-check mr-2"></i>Schedule Tour
                    </button>
                    <button onclick="scrollToSection('enrollment')" class="btn-secondary text-white px-6 py-2 rounded-full font-semibold">
                        <i class="fas fa-user-plus mr-2"></i>Enroll Now
                    </button>
                </div>
                
                <!-- Mobile Menu Button -->
                <button onclick="toggleMobileMenu()" class="md:hidden text-gray-700">
                    <i class="fas fa-bars text-2xl"></i>
                </button>
            </div>
            
            <!-- Mobile Navigation -->
            <div id="mobileMenu" class="mobile-menu md:hidden mt-4">
                <nav class="flex flex-col space-y-3">
                    <a href="#programs" class="text-gray-700 hover:text-purple-600 transition py-2">Programs</a>
                    <a href="#safety" class="text-gray-700 hover:text-purple-600 transition py-2">Safety</a>
                    <a href="#gallery" class="text-gray-700 hover:text-purple-600 transition py-2"><i class="fas fa-images mr-1"></i>Gallery</a>
                    <a href="#team" class="text-gray-700 hover:text-purple-600 transition py-2">Team</a>
                    <a href="#enrollment" class="text-gray-700 hover:text-purple-600 transition py-2">Enrollment</a>
                    <a href="#contact" class="text-gray-700 hover:text-purple-600 transition py-2">Contact</a>
                    <button onclick="scrollToSection('schedule-tour')" class="btn-primary text-white px-6 py-2 rounded-full font-semibold mt-3">
                        Schedule Tour
                    </button>
                </nav>
            </div>
        </div>
    </header>

    <!-- Hero Section -->
    <section class="hero-gradient text-white py-20">
        <div class="container mx-auto px-4">
            <div class="grid md:grid-cols-2 gap-10 items-center">
                <div class="animate-fade-in-up">
                    <h2 class="text-5xl md:text-6xl font-bold mb-6 leading-tight">
                        Where Children Learn, Grow, and Flourish
                    </h2>
                    <p class="text-xl mb-8 text-purple-100">
                        Transforming curiosity into a lifelong love for learning in a safe, nurturing, and licensed environment with measurable progress in core developmental areas.
                    </p>
                    
                    <!-- Trust Badges -->
                    <div class="flex flex-wrap mb-8">
                        <span class="trust-badge">
                            <i class="fas fa-shield-alt text-green-600 mr-2"></i>
                            <span class="text-sm font-semibold text-gray-800">State Licensed</span>
                        </span>
                        <span class="trust-badge">
                            <i class="fas fa-award text-yellow-600 mr-2"></i>
                            <span class="text-sm font-semibold text-gray-800">Accredited Program</span>
                        </span>
                        <span class="trust-badge">
                            <i class="fas fa-star text-yellow-500 mr-2"></i>
                            <span class="text-sm font-semibold text-gray-800">4.9/5 Rating</span>
                        </span>
                        <span class="trust-badge">
                            <i class="fas fa-heart text-red-500 mr-2"></i>
                            <span class="text-sm font-semibold text-gray-800">15+ Years Experience</span>
                        </span>
                    </div>
                    
                    <!-- CTA Buttons -->
                    <div class="flex flex-wrap gap-4">
                        <button onclick="scrollToSection('schedule-tour')" class="bg-white text-purple-700 px-8 py-4 rounded-full font-bold text-lg hover:bg-gray-100 transition">
                            <i class="fas fa-calendar-check mr-2"></i>Schedule a Tour Today
                        </button>
                        <button onclick="scrollToSection('programs')" class="border-2 border-white text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-white hover:text-purple-700 transition">
                            <i class="fas fa-info-circle mr-2"></i>Learn More
                        </button>
                    </div>
                    
                    <!-- Urgency Message -->
                    <p class="mt-6 text-yellow-300 font-semibold">
                        <i class="fas fa-exclamation-circle mr-2"></i>
                        Limited spots available for Fall 2025 enrollment!
                    </p>
                </div>
                
                <div class="hidden md:block">
                    <div class="bg-white rounded-3xl p-2 shadow-2xl">
                        <img src="https://images.unsplash.com/photo-1503454537195-1dcabb73ffb9?w=600&h=600&fit=crop" 
                             alt="Happy children learning and playing in a safe environment" 
                             class="rounded-2xl w-full h-auto">
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Programs Section -->
    <section id="programs" class="py-20 bg-white">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">Our Programs</h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Age-appropriate programs designed to nurture every stage of your child's development with specialized educators and engaging activities.
                </p>
            </div>
            
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
                <!-- Infant Care -->
                <div class="card-hover bg-gradient-to-br from-pink-50 to-pink-100 rounded-2xl p-8 border-2 border-pink-200">
                    <div class="text-5xl mb-4">👶</div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-3">Infant Care</h3>
                    <p class="text-sm text-purple-600 font-semibold mb-4">6 weeks - 18 months</p>
                    
                    <div class="mb-4">
                        <p class="text-gray-700 mb-3">Nurturing care focused on:</p>
                        <ul class="space-y-2 text-sm text-gray-600">
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Secure bonding & attachment</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Sensory exploration</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Developmental milestones</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Individual feeding & sleep schedules</li>
                        </ul>
                    </div>
                    
                    <div class="bg-white rounded-lg p-3 mb-4">
                        <p class="text-xs font-semibold text-gray-700 mb-2">Daily Schedule Highlights:</p>
                        <p class="text-xs text-gray-600">Tummy time, sensory play, music & movement, story time, outdoor exploration</p>
                    </div>
                    
                    <button onclick="openProgramDetails('infant')" class="w-full bg-pink-600 text-white py-3 rounded-lg font-semibold hover:bg-pink-700 transition">
                        Learn More <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
                
                <!-- Toddler Program -->
                <div class="card-hover bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 border-2 border-blue-200">
                    <div class="text-5xl mb-4">🧸</div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-3">Toddler Program</h3>
                    <p class="text-sm text-purple-600 font-semibold mb-4">18 months - 3 years</p>
                    
                    <div class="mb-4">
                        <p class="text-gray-700 mb-3">Active learning through:</p>
                        <ul class="space-y-2 text-sm text-gray-600">
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Language development</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Social skills & sharing</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Independence building</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Potty training support</li>
                        </ul>
                    </div>
                    
                    <div class="bg-white rounded-lg p-3 mb-4">
                        <p class="text-xs font-semibold text-gray-700 mb-2">Daily Schedule Highlights:</p>
                        <p class="text-xs text-gray-600">Creative arts, building blocks, dramatic play, music circle, outdoor play</p>
                    </div>
                    
                    <button onclick="openProgramDetails('toddler')" class="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 transition">
                        Learn More <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
                
                <!-- Preschool -->
                <div class="card-hover bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 border-2 border-green-200">
                    <div class="text-5xl mb-4">🎨</div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-3">Preschool</h3>
                    <p class="text-sm text-purple-600 font-semibold mb-4">3 - 5 years</p>
                    
                    <div class="mb-4">
                        <p class="text-gray-700 mb-3">Kindergarten preparation:</p>
                        <ul class="space-y-2 text-sm text-gray-600">
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Early literacy & numeracy</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Scientific exploration</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Problem-solving skills</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Social-emotional growth</li>
                        </ul>
                    </div>
                    
                    <div class="bg-white rounded-lg p-3 mb-4">
                        <p class="text-xs font-semibold text-gray-700 mb-2">Daily Schedule Highlights:</p>
                        <p class="text-xs text-gray-600">Literacy activities, math games, science experiments, art projects, group activities</p>
                    </div>
                    
                    <button onclick="openProgramDetails('preschool')" class="w-full bg-green-600 text-white py-3 rounded-lg font-semibold hover:bg-green-700 transition">
                        Learn More <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
                
                <!-- School Age Care -->
                <div class="card-hover bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-8 border-2 border-yellow-200">
                    <div class="text-5xl mb-4">📚</div>
                    <h3 class="text-2xl font-bold text-gray-800 mb-3">School Age Care</h3>
                    <p class="text-sm text-purple-600 font-semibold mb-4">5 - 12 years</p>
                    
                    <div class="mb-4">
                        <p class="text-gray-700 mb-3">Before & after school:</p>
                        <ul class="space-y-2 text-sm text-gray-600">
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Homework assistance</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Enrichment activities</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Sports & recreation</li>
                            <li><i class="fas fa-check text-green-600 mr-2"></i>Leadership development</li>
                        </ul>
                    </div>
                    
                    <div class="bg-white rounded-lg p-3 mb-4">
                        <p class="text-xs font-semibold text-gray-700 mb-2">Daily Schedule Highlights:</p>
                        <p class="text-xs text-gray-600">Study time, STEM activities, team sports, creative projects, social clubs</p>
                    </div>
                    
                    <button onclick="openProgramDetails('schoolage')" class="w-full bg-yellow-600 text-white py-3 rounded-lg font-semibold hover:bg-yellow-700 transition">
                        Learn More <i class="fas fa-arrow-right ml-2"></i>
                    </button>
                </div>
            </div>
            
            <!-- Specialist Educators -->
            <div class="mt-16 bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-8">
                <h3 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                    <i class="fas fa-users-cog text-purple-600 mr-3"></i>
                    Our Specialist Educators
                </h3>
                <div class="grid md:grid-cols-3 gap-6">
                    <div class="bg-white rounded-xl p-6 text-center">
                        <i class="fas fa-book-reader text-4xl text-purple-600 mb-3"></i>
                        <h4 class="font-bold text-lg mb-2">Literacy Teacher</h4>
                        <p class="text-sm text-gray-600">Dedicated reading and language development specialist</p>
                    </div>
                    <div class="bg-white rounded-xl p-6 text-center">
                        <i class="fas fa-running text-4xl text-green-600 mb-3"></i>
                        <h4 class="font-bold text-lg mb-2">Active Learning Teacher</h4>
                        <p class="text-sm text-gray-600">Physical development and movement education expert</p>
                    </div>
                    <div class="bg-white rounded-xl p-6 text-center">
                        <i class="fas fa-palette text-4xl text-pink-600 mb-3"></i>
                        <h4 class="font-bold text-lg mb-2">Creative Arts Teacher</h4>
                        <p class="text-sm text-gray-600">Fostering creativity through art, music, and drama</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Safety & Well-Being Section -->
    <section id="safety" class="py-20 bg-gradient-to-br from-blue-50 to-green-50">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-shield-alt text-green-600 mr-3"></i>
                    Safety & Well-Being
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Your child's safety is our top priority. We maintain the highest standards of security, health, and well-being.
                </p>
            </div>
            
            <div class="grid md:grid-cols-2 lg:grid-cols-3 gap-8 mb-12">
                <!-- Staff Qualifications -->
                <div class="bg-white rounded-2xl p-8 shadow-lg">
                    <div class="text-5xl mb-4">👨‍🏫</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Staff Excellence</h3>
                    <ul class="space-y-3 text-gray-600">
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Comprehensive background checks</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>CPR & First Aid certified</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Early childhood education degrees</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Ongoing professional development</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Child abuse prevention training</li>
                    </ul>
                </div>
                
                <!-- Health & Hygiene -->
                <div class="bg-white rounded-2xl p-8 shadow-lg">
                    <div class="text-5xl mb-4">🧼</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Health & Hygiene</h3>
                    <ul class="space-y-3 text-gray-600">
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Daily sanitization protocols</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Air purification systems</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Strict illness policies</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Allergy management plans</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Regular health screenings</li>
                    </ul>
                </div>
                
                <!-- Facility Security -->
                <div class="bg-white rounded-2xl p-8 shadow-lg">
                    <div class="text-5xl mb-4">🔒</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Facility Security</h3>
                    <ul class="space-y-3 text-gray-600">
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Secure entry/exit systems</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Video surveillance 24/7</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Authorized pickup protocols</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Emergency response plans</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Regular safety drills</li>
                    </ul>
                </div>
                
                <!-- Nutrition -->
                <div class="bg-white rounded-2xl p-8 shadow-lg">
                    <div class="text-5xl mb-4">🥗</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Nutrition</h3>
                    <ul class="space-y-3 text-gray-600">
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Nutritious meals & snacks</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Allergy-friendly options</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Age-appropriate portions</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Fresh, wholesome ingredients</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Dietary accommodation</li>
                    </ul>
                </div>
                
                <!-- Emergency Procedures -->
                <div class="bg-white rounded-2xl p-8 shadow-lg">
                    <div class="text-5xl mb-4">🚨</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Emergency Preparedness</h3>
                    <ul class="space-y-3 text-gray-600">
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Fire & tornado drills</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Medical emergency protocols</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Parent notification system</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Emergency supply kits</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Evacuation & reunification plans</li>
                    </ul>
                </div>
                
                <!-- Licensing & Compliance -->
                <div class="bg-white rounded-2xl p-8 shadow-lg">
                    <div class="text-5xl mb-4">📋</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-4">Licensing & Compliance</h3>
                    <ul class="space-y-3 text-gray-600">
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>State licensed facility</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Regular inspections</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Compliance with regulations</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Transparent reporting</li>
                        <li><i class="fas fa-check-circle text-green-600 mr-2"></i>Quality improvement plans</li>
                    </ul>
                </div>
            </div>
            
            <!-- Parent Testimonial about Safety -->
            <div class="bg-white rounded-2xl p-8 shadow-xl max-w-4xl mx-auto">
                <div class="flex items-start mb-6">
                    <i class="fas fa-quote-left text-4xl text-purple-600 mr-4"></i>
                    <div>
                        <p class="text-lg text-gray-700 mb-4">
                            "As a parent, knowing my daughter is in such a safe and nurturing environment gives me complete peace of mind. The staff goes above and beyond to ensure every child's safety and well-being. I can focus on work knowing she's in the best hands."
                        </p>
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-purple-200 rounded-full flex items-center justify-center mr-3">
                                <i class="fas fa-user text-purple-600"></i>
                            </div>
                            <div>
                                <p class="font-bold text-gray-800">Sarah M.</p>
                                <p class="text-sm text-gray-600">Parent of Emma (3 years old)</p>
                                <div class="flex mt-1">
                                    <i class="fas fa-star text-yellow-500"></i>
                                    <i class="fas fa-star text-yellow-500"></i>
                                    <i class="fas fa-star text-yellow-500"></i>
                                    <i class="fas fa-star text-yellow-500"></i>
                                    <i class="fas fa-star text-yellow-500"></i>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Photo Gallery Section -->
    <section id="gallery" class="py-20 bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-images text-purple-600 mr-3"></i>
                    Photo Gallery
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Take a visual tour of our facility, programs, and happy children learning and growing every day.
                </p>
            </div>
            
            <!-- Gallery Category Tabs -->
            <div class="flex flex-wrap justify-center gap-3 mb-12">
                <button onclick="showGalleryCategory('all')" id="gallery-tab-all" class="gallery-tab-active px-6 py-3 rounded-full font-semibold transition-all hover:scale-105">
                    <i class="fas fa-th mr-2"></i>All Photos
                </button>
                <button onclick="showGalleryCategory('classrooms')" id="gallery-tab-classrooms" class="gallery-tab px-6 py-3 rounded-full font-semibold transition-all hover:scale-105">
                    <i class="fas fa-school mr-2"></i>Classrooms
                </button>
                <button onclick="showGalleryCategory('activities')" id="gallery-tab-activities" class="gallery-tab px-6 py-3 rounded-full font-semibold transition-all hover:scale-105">
                    <i class="fas fa-palette mr-2"></i>Activities
                </button>
                <button onclick="showGalleryCategory('meals')" id="gallery-tab-meals" class="gallery-tab px-6 py-3 rounded-full font-semibold transition-all hover:scale-105">
                    <i class="fas fa-apple-alt mr-2"></i>Meal Times
                </button>
                <button onclick="showGalleryCategory('events')" id="gallery-tab-events" class="gallery-tab px-6 py-3 rounded-full font-semibold transition-all hover:scale-105">
                    <i class="fas fa-calendar-star mr-2"></i>Special Events
                </button>
                <button onclick="showGalleryCategory('team')" id="gallery-tab-team" class="gallery-tab px-6 py-3 rounded-full font-semibold transition-all hover:scale-105">
                    <i class="fas fa-users mr-2"></i>Our Team
                </button>
                <button onclick="showGalleryCategory('outdoor')" id="gallery-tab-outdoor" class="gallery-tab px-6 py-3 rounded-full font-semibold transition-all hover:scale-105">
                    <i class="fas fa-tree mr-2"></i>Outdoor Play
                </button>
            </div>
            
            <!-- Gallery Grid -->
            <div id="galleryGrid" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                <!-- Classrooms -->
                <div class="gallery-item classrooms group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(0)">
                    <img src="/gallery/classroom-infant.jpg" alt="Infant and toddler classroom with teacher" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Infant & Toddler Classroom</h3>
                            <p class="text-sm">Safe, nurturing environment</p>
                        </div>
                    </div>
                </div>
                
                <div class="gallery-item activities group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(1)">
                    <img src="/gallery/science-activity.jpg" alt="Science learning activity with colorful experiments" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Science Activities</h3>
                            <p class="text-sm">Hands-on experiments</p>
                        </div>
                    </div>
                </div>
                
                <!-- Activities -->
                <div class="gallery-item activities group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(2)">
                    <img src="/gallery/story-time.jpg" alt="Teacher reading story to engaged children" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Story Time</h3>
                            <p class="text-sm">Building literacy skills</p>
                        </div>
                    </div>
                </div>
                
                <div class="gallery-item activities group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(3)">
                    <img src="/gallery/arts-crafts.jpg" alt="Children doing colorful arts and crafts" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Arts & Crafts</h3>
                            <p class="text-sm">Creative expression time</p>
                        </div>
                    </div>
                </div>
                
                <!-- Meals -->
                <div class="gallery-item meals group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(4)">
                    <img src="/gallery/meal-time-1.jpg" alt="Teacher with children enjoying healthy snacks" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Healthy Snack Time</h3>
                            <p class="text-sm">Fresh fruits & vegetables</p>
                        </div>
                    </div>
                </div>
                
                <div class="gallery-item meals group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(5)">
                    <img src="/gallery/meal-time-2.jpg" alt="Family-style meal time with children" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Family Meal Time</h3>
                            <p class="text-sm">Building social skills</p>
                        </div>
                    </div>
                </div>
                
                <!-- Events -->
                <div class="gallery-item events group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(6)">
                    <img src="/gallery/birthday-celebration.jpg" alt="Birthday celebration with cake and balloons" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Birthday Celebrations</h3>
                            <p class="text-sm">Making memories together</p>
                        </div>
                    </div>
                </div>
                
                <div class="gallery-item events group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(7)">
                    <img src="/gallery/holiday-event.jpg" alt="Holiday celebration with Christmas tree and crafts" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Holiday Events</h3>
                            <p class="text-sm">Celebrating together</p>
                        </div>
                    </div>
                </div>
                
                <!-- Team -->
                <div class="gallery-item team group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(8)">
                    <img src="/gallery/parent-teacher.jpg" alt="Parent-teacher partnership and communication" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Parent-Teacher Partnership</h3>
                            <p class="text-sm">Strong family involvement</p>
                        </div>
                    </div>
                </div>
                
                <div class="gallery-item team group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(9)">
                    <img src="/gallery/team-photo.jpg" alt="Our amazing teaching team with children" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Our Amazing Team</h3>
                            <p class="text-sm">Dedicated & experienced</p>
                        </div>
                    </div>
                </div>
                
                <!-- Outdoor -->
                <div class="gallery-item outdoor group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(10)">
                    <img src="/gallery/outdoor-exploration.jpg" alt="Outdoor nature exploration and learning" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Outdoor Exploration</h3>
                            <p class="text-sm">Nature-based learning</p>
                        </div>
                    </div>
                </div>
                
                <div class="gallery-item outdoor group relative overflow-hidden rounded-xl shadow-lg cursor-pointer transform transition-all hover:scale-105" onclick="openLightbox(11)">
                    <img src="/gallery/playground-fun.jpg" alt="Children playing on slides and swings" class="w-full h-64 object-cover">
                    <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end">
                        <div class="p-4 text-white">
                            <h3 class="font-bold text-lg">Playground Fun</h3>
                            <p class="text-sm">Active physical play</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Note about photos -->
            <div class="text-center mt-12 bg-gradient-to-r from-purple-100 to-blue-100 backdrop-blur rounded-xl p-6 max-w-3xl mx-auto">
                <p class="text-gray-800 text-lg font-semibold">
                    <i class="fas fa-camera text-purple-600 mr-2"></i>
                    View our facility, programs, and happy children in action!
                </p>
                <p class="text-gray-600 text-sm mt-2">
                    Schedule a tour to see us in person at 4014 Bardstown Rd, Louisville, KY 40218
                </p>
            </div>
        </div>
    </section>
    
    <!-- Lightbox Modal -->
    <div id="lightbox" class="fixed inset-0 bg-black bg-opacity-95 hidden items-center justify-center z-50 p-4" style="display: none;" onclick="closeLightbox()">
        <button onclick="closeLightbox()" class="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10">
            <i class="fas fa-times"></i>
        </button>
        <button onclick="previousImage(); event.stopPropagation();" class="absolute left-4 top-1/2 transform -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-10">
            <i class="fas fa-chevron-left"></i>
        </button>
        <button onclick="nextImage(); event.stopPropagation();" class="absolute right-4 top-1/2 transform -translate-y-1/2 text-white text-4xl hover:text-gray-300 z-10">
            <i class="fas fa-chevron-right"></i>
        </button>
        <div class="max-w-6xl max-h-[90vh] w-full" onclick="event.stopPropagation()">
            <img id="lightboxImage" src="" alt="" class="w-full h-full object-contain rounded-lg">
            <div id="lightboxCaption" class="text-white text-center mt-4 text-lg"></div>
        </div>
    </div>

    <!-- Educational Approach Section -->
    <section id="approach" class="py-20 bg-white">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-brain text-purple-600 mr-3"></i>
                    Our Educational Approach
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Play-based learning methodology focused on four core developmental areas with personalized progress tracking.
                </p>
            </div>
            
            <!-- Core Developmental Areas -->
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
                <div class="bg-gradient-to-br from-red-50 to-red-100 rounded-2xl p-8 text-center">
                    <div class="text-6xl mb-4">🧠</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Cognitive Development</h3>
                    <p class="text-gray-600">Problem-solving, critical thinking, memory, and attention skills</p>
                </div>
                
                <div class="bg-gradient-to-br from-blue-50 to-blue-100 rounded-2xl p-8 text-center">
                    <div class="text-6xl mb-4">🤝</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Social-Emotional Growth</h3>
                    <p class="text-gray-600">Self-regulation, empathy, relationships, and emotional awareness</p>
                </div>
                
                <div class="bg-gradient-to-br from-green-50 to-green-100 rounded-2xl p-8 text-center">
                    <div class="text-6xl mb-4">🏃</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Physical Development</h3>
                    <p class="text-gray-600">Gross & fine motor skills, coordination, and healthy habits</p>
                </div>
                
                <div class="bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-2xl p-8 text-center">
                    <div class="text-6xl mb-4">💬</div>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Language & Literacy</h3>
                    <p class="text-gray-600">Communication, vocabulary, reading readiness, and expression</p>
                </div>
            </div>
            
            <!-- Play-Based Learning -->
            <div class="bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-10 mb-16">
                <h3 class="text-3xl font-bold text-gray-800 mb-6 text-center">
                    <i class="fas fa-puzzle-piece text-purple-600 mr-3"></i>
                    Play-Based Learning Philosophy
                </h3>
                <div class="grid md:grid-cols-3 gap-8">
                    <div class="bg-white rounded-xl p-6">
                        <i class="fas fa-lightbulb text-4xl text-yellow-500 mb-4"></i>
                        <h4 class="font-bold text-lg mb-3">Learn Through Exploration</h4>
                        <p class="text-gray-600">Children discover concepts naturally through hands-on activities and guided exploration.</p>
                    </div>
                    <div class="bg-white rounded-xl p-6">
                        <i class="fas fa-user-friends text-4xl text-blue-500 mb-4"></i>
                        <h4 class="font-bold text-lg mb-3">Personalized Learning</h4>
                        <p class="text-gray-600">We adapt activities to each child's interests, learning style, and developmental stage.</p>
                    </div>
                    <div class="bg-white rounded-xl p-6">
                        <i class="fas fa-chart-line text-4xl text-green-500 mb-4"></i>
                        <h4 class="font-bold text-lg mb-3">Measurable Progress</h4>
                        <p class="text-gray-600">Regular assessments track development across all four core areas with parent reports.</p>
                    </div>
                </div>
            </div>
            
            <!-- Sample Activities -->
            <div class="max-w-5xl mx-auto">
                <h3 class="text-3xl font-bold text-gray-800 mb-8 text-center">
                    <i class="fas fa-hands-helping text-purple-600 mr-3"></i>
                    Sample Learning Activities
                </h3>
                <div class="grid md:grid-cols-2 gap-6">
                    <div class="bg-gray-50 rounded-xl p-6 flex">
                        <div class="text-4xl mr-4">📚</div>
                        <div>
                            <h4 class="font-bold text-lg mb-2">Story Time Circle</h4>
                            <p class="text-gray-600 mb-2">Interactive reading sessions that build vocabulary, comprehension, and love of books</p>
                            <span class="text-xs bg-purple-200 text-purple-800 px-3 py-1 rounded-full">Language & Literacy</span>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-xl p-6 flex">
                        <div class="text-4xl mr-4">🔬</div>
                        <div>
                            <h4 class="font-bold text-lg mb-2">Science Experiments</h4>
                            <p class="text-gray-600 mb-2">Hands-on activities exploring cause and effect, hypotheses, and observations</p>
                            <span class="text-xs bg-purple-200 text-purple-800 px-3 py-1 rounded-full">Cognitive Development</span>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-xl p-6 flex">
                        <div class="text-4xl mr-4">🎭</div>
                        <div>
                            <h4 class="font-bold text-lg mb-2">Dramatic Play Center</h4>
                            <p class="text-gray-600 mb-2">Role-playing scenarios that develop empathy, cooperation, and imagination</p>
                            <span class="text-xs bg-purple-200 text-purple-800 px-3 py-1 rounded-full">Social-Emotional</span>
                        </div>
                    </div>
                    
                    <div class="bg-gray-50 rounded-xl p-6 flex">
                        <div class="text-4xl mr-4">⚽</div>
                        <div>
                            <h4 class="font-bold text-lg mb-2">Active Play Time</h4>
                            <p class="text-gray-600 mb-2">Structured physical activities promoting coordination, strength, and teamwork</p>
                            <span class="text-xs bg-purple-200 text-purple-800 px-3 py-1 rounded-full">Physical Development</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Meet the Team Section -->
    <section id="team" class="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-users text-purple-600 mr-3"></i>
                    Meet Our Team
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Qualified, caring educators committed to your child's growth and development.
                </p>
            </div>
            
            <div class="grid md:grid-cols-2 lg:grid-cols-4 gap-8 mb-12">
                <!-- Director -->
                <div class="bg-white rounded-2xl p-6 shadow-lg text-center">
                    <div class="w-32 h-32 bg-purple-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <i class="fas fa-user-tie text-6xl text-purple-600"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-1">Jennifer Thompson</h3>
                    <p class="text-purple-600 font-semibold mb-3">Center Director</p>
                    <p class="text-sm text-gray-600 mb-3">M.Ed. in Early Childhood Education<br/>15+ years experience</p>
                    <p class="text-xs text-gray-600">Passionate about creating nurturing environments where children thrive.</p>
                </div>
                
                <!-- Lead Teacher -->
                <div class="bg-white rounded-2xl p-6 shadow-lg text-center">
                    <div class="w-32 h-32 bg-blue-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <i class="fas fa-user text-6xl text-blue-600"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-1">Maria Garcia</h3>
                    <p class="text-purple-600 font-semibold mb-3">Preschool Lead Teacher</p>
                    <p class="text-sm text-gray-600 mb-3">B.S. Early Childhood Education<br/>8 years experience</p>
                    <p class="text-xs text-gray-600">Specializes in kindergarten readiness and literacy development.</p>
                </div>
                
                <!-- Infant Specialist -->
                <div class="bg-white rounded-2xl p-6 shadow-lg text-center">
                    <div class="w-32 h-32 bg-pink-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <i class="fas fa-user text-6xl text-pink-600"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-1">Emily Chen</h3>
                    <p class="text-purple-600 font-semibold mb-3">Infant Care Specialist</p>
                    <p class="text-sm text-gray-600 mb-3">A.S. Child Development<br/>6 years experience</p>
                    <p class="text-xs text-gray-600">Expert in infant development and nurturing secure attachments.</p>
                </div>
                
                <!-- Active Learning Teacher -->
                <div class="bg-white rounded-2xl p-6 shadow-lg text-center">
                    <div class="w-32 h-32 bg-green-200 rounded-full mx-auto mb-4 flex items-center justify-center">
                        <i class="fas fa-user text-6xl text-green-600"></i>
                    </div>
                    <h3 class="text-xl font-bold text-gray-800 mb-1">David Williams</h3>
                    <p class="text-purple-600 font-semibold mb-3">Active Learning Teacher</p>
                    <p class="text-sm text-gray-600 mb-3">B.S. Physical Education<br/>10 years experience</p>
                    <p class="text-xs text-gray-600">Promotes physical development through engaging movement activities.</p>
                </div>
            </div>
            
            <!-- Staff Commitment -->
            <div class="bg-white rounded-2xl p-8 shadow-xl max-w-4xl mx-auto mb-12">
                <h3 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                    <i class="fas fa-certificate text-purple-600 mr-3"></i>
                    Our Staff Commitment
                </h3>
                <div class="grid md:grid-cols-3 gap-6">
                    <div class="text-center">
                        <i class="fas fa-graduation-cap text-4xl text-purple-600 mb-3"></i>
                        <h4 class="font-bold mb-2">Highly Qualified</h4>
                        <p class="text-sm text-gray-600">All staff hold degrees or certifications in early childhood education</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-book-open text-4xl text-blue-600 mb-3"></i>
                        <h4 class="font-bold mb-2">Continuous Learning</h4>
                        <p class="text-sm text-gray-600">Regular professional development and training workshops</p>
                    </div>
                    <div class="text-center">
                        <i class="fas fa-heart text-4xl text-pink-600 mb-3"></i>
                        <h4 class="font-bold mb-2">Passionate Care</h4>
                        <p class="text-sm text-gray-600">Dedicated to nurturing every child's unique potential</p>
                    </div>
                </div>
            </div>
            
            <!-- Join Our Team Section -->
            <div class="max-w-6xl mx-auto">
                <div class="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-10 text-white mb-8 text-center">
                    <i class="fas fa-users text-6xl mb-4"></i>
                    <h3 class="text-3xl font-bold mb-4">Join Our Amazing Team!</h3>
                    <p class="text-xl mb-6">We're always looking for passionate, qualified educators to join our family.</p>
                </div>
                
                <!-- Requirements Checklist -->
                <div class="bg-gradient-to-r from-purple-100 to-blue-100 rounded-2xl p-8 mb-8">
                    <h3 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                        <i class="fas fa-clipboard-check text-purple-600 mr-3"></i>
                        Employment Requirements
                    </h3>
                    <div class="grid md:grid-cols-2 gap-4">
                        <div class="bg-white rounded-lg p-4 flex items-center">
                            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                            <span class="text-gray-700">Early Childhood Education degree or certification</span>
                        </div>
                        <div class="bg-white rounded-lg p-4 flex items-center">
                            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                            <span class="text-gray-700">Background check clearance</span>
                        </div>
                        <div class="bg-white rounded-lg p-4 flex items-center">
                            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                            <span class="text-gray-700">CPR & First Aid certification</span>
                        </div>
                        <div class="bg-white rounded-lg p-4 flex items-center">
                            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                            <span class="text-gray-700">Child abuse prevention training</span>
                        </div>
                        <div class="bg-white rounded-lg p-4 flex items-center">
                            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                            <span class="text-gray-700">Clean health screening</span>
                        </div>
                        <div class="bg-white rounded-lg p-4 flex items-center">
                            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                            <span class="text-gray-700">Professional references</span>
                        </div>
                        <div class="bg-white rounded-lg p-4 flex items-center">
                            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                            <span class="text-gray-700">Valid driver's license and transportation</span>
                        </div>
                        <div class="bg-white rounded-lg p-4 flex items-center">
                            <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                            <span class="text-gray-700">Passion for working with children</span>
                        </div>
                    </div>
                </div>
                
                <!-- Official PDF Form Download -->
                <div class="bg-gradient-to-r from-green-600 to-teal-600 rounded-2xl p-8 shadow-xl mb-8">
                    <div class="text-center">
                        <div class="text-6xl mb-4">💼</div>
                        <h3 class="text-3xl font-bold text-white mb-4">
                            Official Employment Application Form
                        </h3>
                        <p class="text-white text-lg mb-6 max-w-2xl mx-auto">
                            Download our official employment application, fill it out at your convenience, and email it to us at 
                            <a href="mailto:LearnandGrowCC@gmail.com" class="font-bold underline hover:text-yellow-300">LearnandGrowCC@gmail.com</a>
                        </p>
                        <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                            <a href="/forms/employment-application.pdf" target="_blank" 
                               class="bg-white text-green-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 hover:text-green-700 transition shadow-lg flex items-center gap-2">
                                <i class="fas fa-download"></i>
                                Download PDF Form
                            </a>
                            <a href="mailto:LearnandGrowCC@gmail.com" 
                               class="bg-yellow-400 text-green-900 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 transition shadow-lg flex items-center gap-2">
                                <i class="fas fa-envelope"></i>
                                Email Form to Us
                            </a>
                        </div>
                        <p class="text-white text-sm mt-4 opacity-90">
                            <i class="fas fa-info-circle mr-1"></i>
                            The form will open in a new window. You can fill it out and save it on your computer.
                        </p>
                    </div>
                </div>
                
                <!-- Alternative: Quick Online Form Button -->
                <div class="text-center mb-12">
                    <p class="text-gray-600 text-lg mb-4">
                        <strong>Prefer to fill out a form online?</strong>
                    </p>
                    <button onclick="openEmploymentModal()" 
                            class="bg-gradient-to-r from-green-600 to-teal-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 inline-flex items-center gap-2">
                        <i class="fas fa-edit"></i>
                        Fill Out Quick Online Form
                    </button>
                </div>
                
                <!-- Employment Modal (Hidden by Default) -->
                <div id="employmentModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 p-4" style="display: none;" onclick="if(event.target === this) closeEmploymentModal()">
                    <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative" onclick="event.stopPropagation()">
                        <!-- Close Button -->
                        <button onclick="closeEmploymentModal()" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-3xl font-bold z-10">
                            <i class="fas fa-times"></i>
                        </button>
                        
                        <!-- Employment Application Form -->
                        <div id="employment-form" class="p-8">
                    <h3 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                        <i class="fas fa-briefcase text-purple-600 mr-3"></i>
                        Quick Online Employment Form
                    </h3>
                    <p class="text-center text-gray-600 mb-8">Complete this form to apply for a position at Learn & Grow Childcare Center.</p>
                    
                    <form id="employmentForm" class="space-y-6">
                        <!-- Personal Information -->
                        <div class="border-b border-gray-200 pb-6">
                            <h4 class="text-xl font-bold text-gray-800 mb-4">Personal Information</h4>
                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">First Name *</label>
                                    <input type="text" name="firstName" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                </div>
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">Last Name *</label>
                                    <input type="text" name="lastName" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                </div>
                            </div>
                            <div class="grid md:grid-cols-2 gap-4 mt-4">
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">Email *</label>
                                    <input type="email" name="email" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                </div>
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">Phone *</label>
                                    <input type="tel" name="phone" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                </div>
                            </div>
                            <div class="mt-4">
                                <label class="block text-gray-700 font-semibold mb-2">Address *</label>
                                <input type="text" name="address" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                        </div>
                        
                        <!-- Position Information -->
                        <div class="border-b border-gray-200 pb-6">
                            <h4 class="text-xl font-bold text-gray-800 mb-4">Position Information</h4>
                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">Position Applying For *</label>
                                    <select name="position" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                        <option value="">Select a position</option>
                                        <option value="lead-teacher">Lead Teacher</option>
                                        <option value="assistant-teacher">Assistant Teacher</option>
                                        <option value="infant-specialist">Infant Care Specialist</option>
                                        <option value="toddler-teacher">Toddler Teacher</option>
                                        <option value="preschool-teacher">Preschool Teacher</option>
                                        <option value="school-age-teacher">School Age Teacher</option>
                                        <option value="substitute">Substitute Teacher</option>
                                        <option value="admin">Administrative Staff</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">Available Start Date *</label>
                                    <input type="date" name="startDate" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                </div>
                            </div>
                            <div class="mt-4">
                                <label class="block text-gray-700 font-semibold mb-2">Desired Schedule *</label>
                                <select name="schedule" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    <option value="">Select...</option>
                                    <option value="full-time">Full-Time</option>
                                    <option value="part-time">Part-Time</option>
                                    <option value="substitute">Substitute/As Needed</option>
                                </select>
                            </div>
                        </div>
                        
                        <!-- Education & Qualifications -->
                        <div class="border-b border-gray-200 pb-6">
                            <h4 class="text-xl font-bold text-gray-800 mb-4">Education & Qualifications</h4>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Highest Education Level *</label>
                                <select name="education" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    <option value="">Select...</option>
                                    <option value="high-school">High School Diploma/GED</option>
                                    <option value="some-college">Some College</option>
                                    <option value="associates">Associate's Degree</option>
                                    <option value="bachelors">Bachelor's Degree</option>
                                    <option value="masters">Master's Degree</option>
                                    <option value="doctorate">Doctorate</option>
                                </select>
                            </div>
                            <div class="mt-4">
                                <label class="block text-gray-700 font-semibold mb-2">Major/Field of Study</label>
                                <input type="text" name="major" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="e.g., Early Childhood Education">
                            </div>
                            <div class="mt-4">
                                <label class="block text-gray-700 font-semibold mb-2">Certifications (list all relevant certifications)</label>
                                <textarea name="certifications" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="e.g., CDA, CPR/First Aid, Child Development Associate, etc."></textarea>
                            </div>
                        </div>
                        
                        <!-- Experience -->
                        <div class="border-b border-gray-200 pb-6">
                            <h4 class="text-xl font-bold text-gray-800 mb-4">Experience</h4>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Years of Experience in Childcare *</label>
                                <select name="experience" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    <option value="">Select...</option>
                                    <option value="0-1">Less than 1 year</option>
                                    <option value="1-2">1-2 years</option>
                                    <option value="3-5">3-5 years</option>
                                    <option value="5-10">5-10 years</option>
                                    <option value="10+">10+ years</option>
                                </select>
                            </div>
                            <div class="mt-4">
                                <label class="block text-gray-700 font-semibold mb-2">Previous Work Experience (list most recent positions)</label>
                                <textarea name="workHistory" rows="4" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="Include employer name, position, dates worked, and responsibilities"></textarea>
                            </div>
                        </div>
                        
                        <!-- References -->
                        <div class="border-b border-gray-200 pb-6">
                            <h4 class="text-xl font-bold text-gray-800 mb-4">Professional References</h4>
                            <p class="text-sm text-gray-600 mb-4">Please provide at least 2 professional references (not family members)</p>
                            
                            <!-- Reference 1 -->
                            <div class="bg-gray-50 rounded-lg p-4 mb-4">
                                <p class="font-bold text-gray-700 mb-3">Reference 1</p>
                                <div class="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-gray-700 font-semibold mb-2">Name *</label>
                                        <input type="text" name="ref1Name" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    </div>
                                    <div>
                                        <label class="block text-gray-700 font-semibold mb-2">Phone *</label>
                                        <input type="tel" name="ref1Phone" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    </div>
                                    <div>
                                        <label class="block text-gray-700 font-semibold mb-2">Relationship *</label>
                                        <input type="text" name="ref1Relationship" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="e.g., Former Supervisor">
                                    </div>
                                    <div>
                                        <label class="block text-gray-700 font-semibold mb-2">Email</label>
                                        <input type="email" name="ref1Email" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Reference 2 -->
                            <div class="bg-gray-50 rounded-lg p-4">
                                <p class="font-bold text-gray-700 mb-3">Reference 2</p>
                                <div class="grid md:grid-cols-2 gap-4">
                                    <div>
                                        <label class="block text-gray-700 font-semibold mb-2">Name *</label>
                                        <input type="text" name="ref2Name" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    </div>
                                    <div>
                                        <label class="block text-gray-700 font-semibold mb-2">Phone *</label>
                                        <input type="tel" name="ref2Phone" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    </div>
                                    <div>
                                        <label class="block text-gray-700 font-semibold mb-2">Relationship *</label>
                                        <input type="text" name="ref2Relationship" required class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="e.g., Former Colleague">
                                    </div>
                                    <div>
                                        <label class="block text-gray-700 font-semibold mb-2">Email</label>
                                        <input type="email" name="ref2Email" class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Additional Information -->
                        <div>
                            <h4 class="text-xl font-bold text-gray-800 mb-4">Additional Information</h4>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Why do you want to work at Learn & Grow Childcare Center? *</label>
                                <textarea name="whyJoin" rows="3" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"></textarea>
                            </div>
                            <div class="mt-4">
                                <label class="block text-gray-700 font-semibold mb-2">Additional Comments</label>
                                <textarea name="comments" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"></textarea>
                            </div>
                        </div>
                        
                        <!-- Submit Button -->
                        <div class="bg-purple-50 rounded-lg p-6 text-center">
                            <p class="text-sm text-gray-600 mb-4">
                                By submitting this application, you certify that all information provided is true and complete. You authorize us to conduct background checks and contact references.
                            </p>
                            <button type="submit" class="btn-primary text-white px-12 py-4 rounded-lg font-bold text-lg">
                                <i class="fas fa-paper-plane mr-2"></i>Submit Employment Application
                            </button>
                        </div>
                    </form>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Enrollment Section -->
    <section id="enrollment" class="py-20 bg-white">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-user-plus text-purple-600 mr-3"></i>
                    Enrollment & Admission
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Join our learning family! Follow these simple steps to enroll your child.
                </p>
            </div>
            
            <!-- Enrollment Steps -->
            <div class="max-w-5xl mx-auto mb-16">
                <div class="relative">
                    <!-- Timeline Line -->
                    <div class="hidden md:block absolute left-1/2 transform -translate-x-1/2 h-full w-1 bg-purple-200"></div>
                    
                    <!-- Step 1 -->
                    <div class="mb-8 flex flex-col md:flex-row items-center">
                        <div class="md:w-1/2 md:pr-8 md:text-right mb-4 md:mb-0">
                            <div class="bg-purple-100 rounded-xl p-6">
                                <h3 class="text-2xl font-bold text-purple-800 mb-2">Step 1: Schedule a Tour</h3>
                                <p class="text-gray-700">Visit our facility, meet our staff, and see our programs in action.</p>
                            </div>
                        </div>
                        <div class="relative flex-shrink-0">
                            <div class="w-16 h-16 bg-purple-600 rounded-full flex items-center justify-center text-white text-2xl font-bold z-10 relative">
                                1
                            </div>
                        </div>
                        <div class="md:w-1/2 md:pl-8"></div>
                    </div>
                    
                    <!-- Step 2 -->
                    <div class="mb-8 flex flex-col md:flex-row items-center">
                        <div class="md:w-1/2 md:pr-8"></div>
                        <div class="relative flex-shrink-0">
                            <div class="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center text-white text-2xl font-bold z-10 relative">
                                2
                            </div>
                        </div>
                        <div class="md:w-1/2 md:pl-8 mb-4 md:mb-0">
                            <div class="bg-blue-100 rounded-xl p-6">
                                <h3 class="text-2xl font-bold text-blue-800 mb-2">Step 2: Submit Application</h3>
                                <p class="text-gray-700">Complete our enrollment application with your child's information.</p>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Step 3 -->
                    <div class="mb-8 flex flex-col md:flex-row items-center">
                        <div class="md:w-1/2 md:pr-8 md:text-right mb-4 md:mb-0">
                            <div class="bg-green-100 rounded-xl p-6">
                                <h3 class="text-2xl font-bold text-green-800 mb-2">Step 3: Provide Documents</h3>
                                <p class="text-gray-700">Submit immunization records, emergency contacts, and required forms.</p>
                            </div>
                        </div>
                        <div class="relative flex-shrink-0">
                            <div class="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center text-white text-2xl font-bold z-10 relative">
                                3
                            </div>
                        </div>
                        <div class="md:w-1/2 md:pl-8"></div>
                    </div>
                    
                    <!-- Step 4 -->
                    <div class="flex flex-col md:flex-row items-center">
                        <div class="md:w-1/2 md:pr-8"></div>
                        <div class="relative flex-shrink-0">
                            <div class="w-16 h-16 bg-yellow-600 rounded-full flex items-center justify-center text-white text-2xl font-bold z-10 relative">
                                4
                            </div>
                        </div>
                        <div class="md:w-1/2 md:pl-8 mb-4 md:mb-0">
                            <div class="bg-yellow-100 rounded-xl p-6">
                                <h3 class="text-2xl font-bold text-yellow-800 mb-2">Step 4: Start Date</h3>
                                <p class="text-gray-700">Attend orientation and begin your child's learning journey!</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Required Documents -->
            <div class="bg-gradient-to-r from-purple-100 to-blue-100 rounded-2xl p-8 mb-12 max-w-4xl mx-auto">
                <h3 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                    <i class="fas fa-file-alt text-purple-600 mr-3"></i>
                    Required Documents
                </h3>
                <div class="grid md:grid-cols-2 gap-4">
                    <div class="bg-white rounded-lg p-4 flex items-center">
                        <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                        <span class="text-gray-700">Birth certificate copy</span>
                    </div>
                    <div class="bg-white rounded-lg p-4 flex items-center">
                        <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                        <span class="text-gray-700">Immunization records</span>
                    </div>
                    <div class="bg-white rounded-lg p-4 flex items-center">
                        <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                        <span class="text-gray-700">Emergency contact information</span>
                    </div>
                    <div class="bg-white rounded-lg p-4 flex items-center">
                        <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                        <span class="text-gray-700">Photo ID of parents/guardians</span>
                    </div>
                    <div class="bg-white rounded-lg p-4 flex items-center">
                        <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                        <span class="text-gray-700">Health assessment form</span>
                    </div>
                    <div class="bg-white rounded-lg p-4 flex items-center">
                        <i class="fas fa-check-circle text-green-600 text-2xl mr-3"></i>
                        <span class="text-gray-700">Allergy/medication information</span>
                    </div>
                </div>
            </div>
            
            <!-- Official PDF Form Download -->
            <div class="bg-gradient-to-r from-purple-600 to-blue-600 rounded-2xl p-8 shadow-xl max-w-4xl mx-auto mb-8">
                <div class="text-center">
                    <div class="text-6xl mb-4">📄</div>
                    <h3 class="text-3xl font-bold text-white mb-4">
                        Official Enrollment Application Form
                    </h3>
                    <p class="text-white text-lg mb-6 max-w-2xl mx-auto">
                        Download our official enrollment form, fill it out at your convenience, and email it to us at 
                        <a href="mailto:LearnandGrowCC@gmail.com" class="font-bold underline hover:text-yellow-300">LearnandGrowCC@gmail.com</a>
                    </p>
                    <div class="flex flex-col sm:flex-row gap-4 justify-center items-center">
                        <a href="/forms/enrollment-application.pdf" target="_blank" 
                           class="bg-white text-purple-600 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 hover:text-purple-700 transition shadow-lg flex items-center gap-2">
                            <i class="fas fa-download"></i>
                            Download PDF Form
                        </a>
                        <a href="mailto:LearnandGrowCC@gmail.com" 
                           class="bg-yellow-400 text-purple-900 px-8 py-4 rounded-lg font-bold text-lg hover:bg-yellow-300 transition shadow-lg flex items-center gap-2">
                            <i class="fas fa-envelope"></i>
                            Email Form to Us
                        </a>
                    </div>
                    <p class="text-white text-sm mt-4 opacity-90">
                        <i class="fas fa-info-circle mr-1"></i>
                        The form will open in a new window. You can fill it out and save it on your computer.
                    </p>
                </div>
            </div>
            
            <!-- Alternative: Quick Online Form Button -->
            <div class="text-center max-w-4xl mx-auto mb-12">
                <p class="text-gray-600 text-lg mb-4">
                    <strong>Prefer to fill out a form online?</strong>
                </p>
                <button onclick="openEnrollmentModal()" 
                        class="bg-gradient-to-r from-purple-600 to-blue-600 text-white px-8 py-4 rounded-lg font-bold text-lg hover:shadow-2xl hover:scale-105 transition-all duration-300 inline-flex items-center gap-2">
                    <i class="fas fa-edit"></i>
                    Fill Out Quick Online Form
                </button>
            </div>
            
            <!-- Enrollment Modal (Hidden by Default) -->
            <div id="enrollmentModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50 p-4" style="display: none;" onclick="if(event.target === this) closeEnrollmentModal()">
                <div class="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative" onclick="event.stopPropagation()">
                    <!-- Close Button -->
                    <button onclick="closeEnrollmentModal()" class="absolute top-4 right-4 text-gray-500 hover:text-gray-700 text-3xl font-bold z-10">
                        <i class="fas fa-times"></i>
                    </button>
                    
                    <!-- Enrollment Application Form -->
                    <div id="enrollment-form" class="p-8">
                <h3 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                    <i class="fas fa-file-alt text-purple-600 mr-3"></i>
                    Quick Online Enrollment Form
                </h3>
                <p class="text-center text-gray-600 mb-8">Fill out this form to begin the enrollment process. We'll review your application and contact you within 24 hours.</p>
                
                <form id="enrollmentForm" class="space-y-6">
                    <!-- Parent/Guardian Information -->
                    <div class="border-b border-gray-200 pb-6">
                        <h4 class="text-xl font-bold text-gray-800 mb-4">Parent/Guardian Information</h4>
                        <div class="grid md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">First Name *</label>
                                <input type="text" name="parentFirstName" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Last Name *</label>
                                <input type="text" name="parentLastName" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                        </div>
                        <div class="grid md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Email *</label>
                                <input type="email" name="parentEmail" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Phone *</label>
                                <input type="tel" name="parentPhone" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                        </div>
                        <div class="mt-4">
                            <label class="block text-gray-700 font-semibold mb-2">Home Address *</label>
                            <input type="text" name="homeAddress" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                        </div>
                    </div>
                    
                    <!-- Child Information -->
                    <div class="border-b border-gray-200 pb-6">
                        <h4 class="text-xl font-bold text-gray-800 mb-4">Child Information</h4>
                        <div class="grid md:grid-cols-3 gap-4">
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Child's First Name *</label>
                                <input type="text" name="childFirstName" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Child's Last Name *</label>
                                <input type="text" name="childLastName" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Date of Birth *</label>
                                <input type="date" name="childDOB" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                        </div>
                        <div class="grid md:grid-cols-2 gap-4 mt-4">
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Gender</label>
                                <select name="childGender" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    <option value="">Select...</option>
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                    <option value="other">Other</option>
                                </select>
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Program *</label>
                                <select name="program" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    <option value="">Select a program</option>
                                    <option value="infant">Infant Care (6 weeks - 18 months)</option>
                                    <option value="toddler">Toddler Program (18 months - 3 years)</option>
                                    <option value="preschool">Preschool (3 - 5 years)</option>
                                    <option value="schoolage">School Age Care (5 - 12 years)</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Enrollment Details -->
                    <div class="border-b border-gray-200 pb-6">
                        <h4 class="text-xl font-bold text-gray-800 mb-4">Enrollment Details</h4>
                        <div class="grid md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Desired Start Date *</label>
                                <input type="date" name="startDate" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Schedule Type *</label>
                                <select name="scheduleType" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    <option value="">Select...</option>
                                    <option value="full-time">Full-Time (5 days/week)</option>
                                    <option value="part-time">Part-Time (2-4 days/week)</option>
                                    <option value="before-after">Before/After School Only</option>
                                </select>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Emergency Contact -->
                    <div class="border-b border-gray-200 pb-6">
                        <h4 class="text-xl font-bold text-gray-800 mb-4">Emergency Contact</h4>
                        <div class="grid md:grid-cols-2 gap-4">
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Emergency Contact Name *</label>
                                <input type="text" name="emergencyName" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Emergency Contact Phone *</label>
                                <input type="tel" name="emergencyPhone" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                        </div>
                        <div class="mt-4">
                            <label class="block text-gray-700 font-semibold mb-2">Relationship to Child *</label>
                            <input type="text" name="emergencyRelationship" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="e.g., Grandmother, Uncle, Family Friend">
                        </div>
                    </div>
                    
                    <!-- Medical Information -->
                    <div class="border-b border-gray-200 pb-6">
                        <h4 class="text-xl font-bold text-gray-800 mb-4">Medical Information</h4>
                        <div>
                            <label class="block text-gray-700 font-semibold mb-2">Allergies</label>
                            <textarea name="allergies" rows="2" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="List any known allergies"></textarea>
                        </div>
                        <div class="mt-4">
                            <label class="block text-gray-700 font-semibold mb-2">Special Medical Needs</label>
                            <textarea name="medicalNeeds" rows="2" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="Any medical conditions or special requirements"></textarea>
                        </div>
                        <div class="mt-4">
                            <label class="block text-gray-700 font-semibold mb-2">Pediatrician Name and Phone</label>
                            <input type="text" name="pediatrician" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                        </div>
                    </div>
                    
                    <!-- Additional Information -->
                    <div>
                        <h4 class="text-xl font-bold text-gray-800 mb-4">Additional Information</h4>
                        <div>
                            <label class="block text-gray-700 font-semibold mb-2">How did you hear about us?</label>
                            <select name="referralSource" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                <option value="">Select...</option>
                                <option value="google">Google Search</option>
                                <option value="facebook">Facebook</option>
                                <option value="friend">Friend/Family Referral</option>
                                <option value="sign">Saw Our Sign</option>
                                <option value="other">Other</option>
                            </select>
                        </div>
                        <div class="mt-4">
                            <label class="block text-gray-700 font-semibold mb-2">Additional Comments or Questions</label>
                            <textarea name="additionalComments" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"></textarea>
                        </div>
                    </div>
                    
                    <!-- Submit Button -->
                    <div class="bg-purple-50 rounded-lg p-6 text-center">
                        <p class="text-sm text-gray-600 mb-4">
                            By submitting this form, you agree to our enrollment policies and authorize us to contact you regarding your application.
                        </p>
                        <button type="submit" class="btn-primary text-white px-12 py-4 rounded-lg font-bold text-lg">
                            <i class="fas fa-paper-plane mr-2"></i>Submit Enrollment Application
                        </button>
                    </div>
                </form>
                    </div>
                </div>
            </div>
            
            <!-- Enrollment FAQ -->
            <div class="max-w-4xl mx-auto">
                <h3 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                    <i class="fas fa-question-circle text-purple-600 mr-3"></i>
                    Enrollment FAQ
                </h3>
                <div class="space-y-4">
                    <div class="bg-gray-50 rounded-xl p-6">
                        <h4 class="font-bold text-lg mb-2">What are your operating hours?</h4>
                        <p class="text-gray-600">We're open Monday-Friday, 6:30 AM - 6:00 PM. We're closed on major holidays.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-6">
                        <h4 class="font-bold text-lg mb-2">What is your teacher-to-child ratio?</h4>
                        <p class="text-gray-600">We maintain state-recommended ratios: 1:4 for infants, 1:6 for toddlers, 1:10 for preschoolers, and 1:15 for school-age children.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-6">
                        <h4 class="font-bold text-lg mb-2">Do you provide meals?</h4>
                        <p class="text-gray-600">Yes! We provide nutritious breakfast, lunch, and snacks. We accommodate dietary restrictions and allergies.</p>
                    </div>
                    <div class="bg-gray-50 rounded-xl p-6">
                        <h4 class="font-bold text-lg mb-2">What is your tuition structure?</h4>
                        <p class="text-gray-600">Tuition varies by program and age group. Please contact us for specific pricing and payment options. We offer flexible payment plans.</p>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Parent Resources Section -->
    <section id="resources" class="py-20 bg-gradient-to-br from-green-50 to-blue-50">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-hands-helping text-purple-600 mr-3"></i>
                    Parent Resources
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Stay connected and involved in your child's learning journey.
                </p>
            </div>
            
            <div class="grid md:grid-cols-3 gap-8 mb-12">
                <!-- Daily Updates -->
                <div class="bg-white rounded-2xl p-8 shadow-lg text-center">
                    <i class="fas fa-mobile-alt text-6xl text-purple-600 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Daily Updates</h3>
                    <p class="text-gray-600 mb-4">Receive real-time photos, videos, and reports about your child's day through our parent app.</p>
                    <ul class="text-sm text-gray-600 space-y-2">
                        <li><i class="fas fa-check text-green-600 mr-2"></i>Activity photos</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>Meal & nap logs</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>Developmental milestones</li>
                    </ul>
                </div>
                
                <!-- Parent Conferences -->
                <div class="bg-white rounded-2xl p-8 shadow-lg text-center">
                    <i class="fas fa-comments text-6xl text-blue-600 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">Parent Conferences</h3>
                    <p class="text-gray-600 mb-4">Regular one-on-one meetings to discuss your child's progress and development.</p>
                    <ul class="text-sm text-gray-600 space-y-2">
                        <li><i class="fas fa-check text-green-600 mr-2"></i>Bi-annual conferences</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>Progress reports</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>Goal setting</li>
                    </ul>
                </div>
                
                <!-- Learning Activities -->
                <div class="bg-white rounded-2xl p-8 shadow-lg text-center">
                    <i class="fas fa-home text-6xl text-green-600 mb-4"></i>
                    <h3 class="text-xl font-bold text-gray-800 mb-3">At-Home Activities</h3>
                    <p class="text-gray-600 mb-4">Weekly activity ideas to extend learning at home and reinforce classroom concepts.</p>
                    <ul class="text-sm text-gray-600 space-y-2">
                        <li><i class="fas fa-check text-green-600 mr-2"></i>Activity guides</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>Reading lists</li>
                        <li><i class="fas fa-check text-green-600 mr-2"></i>Craft ideas</li>
                    </ul>
                </div>
            </div>
            
            <!-- Communication Methods -->
            <div class="bg-white rounded-2xl p-8 shadow-xl max-w-4xl mx-auto">
                <h3 class="text-2xl font-bold text-gray-800 mb-6 text-center">
                    <i class="fas fa-envelope text-purple-600 mr-3"></i>
                    How We Stay Connected
                </h3>
                <div class="grid md:grid-cols-2 gap-6">
                    <div class="flex items-start">
                        <i class="fas fa-phone-alt text-2xl text-purple-600 mr-4 mt-1"></i>
                        <div>
                            <h4 class="font-bold mb-1">Phone & Text</h4>
                            <p class="text-sm text-gray-600">Quick updates and urgent communications</p>
                        </div>
                    </div>
                    <div class="flex items-start">
                        <i class="fas fa-at text-2xl text-blue-600 mr-4 mt-1"></i>
                        <div>
                            <h4 class="font-bold mb-1">Email Updates</h4>
                            <p class="text-sm text-gray-600">Weekly newsletters and important announcements</p>
                        </div>
                    </div>
                    <div class="flex items-start">
                        <i class="fas fa-calendar-alt text-2xl text-green-600 mr-4 mt-1"></i>
                        <div>
                            <h4 class="font-bold mb-1">Parent Portal</h4>
                            <p class="text-sm text-gray-600">Access records, schedules, and documents online</p>
                        </div>
                    </div>
                    <div class="flex items-start">
                        <i class="fas fa-users text-2xl text-yellow-600 mr-4 mt-1"></i>
                        <div>
                            <h4 class="font-bold mb-1">Parent Events</h4>
                            <p class="text-sm text-gray-600">Family nights, workshops, and celebrations</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Testimonials Section -->
    <section id="testimonials" class="py-20 bg-white">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-quote-left text-purple-600 mr-3"></i>
                    What Parents Say
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Trusted by families in our community. See what parents love about Learn & Grow.
                </p>
                <div class="flex justify-center items-center mt-4">
                    <div class="flex text-yellow-500 text-2xl">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                    </div>
                    <span class="ml-3 text-gray-700 font-semibold">4.9 out of 5 (127 reviews)</span>
                </div>
            </div>
            
            <div class="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
                <!-- Testimonial 1 -->
                <div class="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-8 shadow-lg">
                    <div class="flex text-yellow-500 mb-4">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                    </div>
                    <p class="text-gray-700 mb-6 italic">
                        "My son has flourished at Learn & Grow! The teachers are incredibly caring and the curriculum is outstanding. He comes home excited to tell me what he learned every day."
                    </p>
                    <div class="flex items-center">
                        <div class="w-12 h-12 bg-purple-300 rounded-full flex items-center justify-center mr-3">
                            <i class="fas fa-user text-purple-700"></i>
                        </div>
                        <div>
                            <p class="font-bold">Jennifer K.</p>
                            <p class="text-sm text-gray-600">Parent of Lucas (4 years)</p>
                        </div>
                    </div>
                </div>
                
                <!-- Testimonial 2 -->
                <div class="bg-gradient-to-br from-blue-50 to-green-50 rounded-2xl p-8 shadow-lg">
                    <div class="flex text-yellow-500 mb-4">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                    </div>
                    <p class="text-gray-700 mb-6 italic">
                        "The safety measures and cleanliness are top-notch. I never worry about my daughter when she's here. The staff treats her like family and I appreciate the daily photo updates!"
                    </p>
                    <div class="flex items-center">
                        <div class="w-12 h-12 bg-blue-300 rounded-full flex items-center justify-center mr-3">
                            <i class="fas fa-user text-blue-700"></i>
                        </div>
                        <div>
                            <p class="font-bold">Michael & Lisa R.</p>
                            <p class="text-sm text-gray-600">Parents of Sophia (2 years)</p>
                        </div>
                    </div>
                </div>
                
                <!-- Testimonial 3 -->
                <div class="bg-gradient-to-br from-yellow-50 to-orange-50 rounded-2xl p-8 shadow-lg">
                    <div class="flex text-yellow-500 mb-4">
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                        <i class="fas fa-star"></i>
                    </div>
                    <p class="text-gray-700 mb-6 italic">
                        "Best decision we made! The preschool program prepared our daughter so well for kindergarten. She's reading, counting, and has amazing social skills. Thank you, Learn & Grow!"
                    </p>
                    <div class="flex items-center">
                        <div class="w-12 h-12 bg-yellow-300 rounded-full flex items-center justify-center mr-3">
                            <i class="fas fa-user text-yellow-700"></i>
                        </div>
                        <div>
                            <p class="font-bold">Amanda T.</p>
                            <p class="text-sm text-gray-600">Parent of Olivia (5 years)</p>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Video Testimonials -->
            <div class="mt-12 max-w-6xl mx-auto">
                <div class="text-center mb-8">
                    <h3 class="text-3xl font-bold text-gray-800 mb-3">
                        <i class="fas fa-video text-purple-600 mr-3"></i>
                        Watch Parent Testimonials
                    </h3>
                    <p class="text-xl text-gray-600">Hear directly from parents about their experiences with Learn & Grow Childcare Center.</p>
                </div>
                
                <div class="grid md:grid-cols-2 gap-8">
                    <!-- Video 1 -->
                    <div class="bg-white rounded-2xl overflow-hidden shadow-lg">
                        <div class="relative" style="padding-bottom: 56.25%; height: 0;">
                            <iframe 
                                class="absolute top-0 left-0 w-full h-full"
                                src="https://www.youtube.com/embed/dQw4w9WgXcQ" 
                                title="Parent Testimonial 1"
                                frameborder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen>
                            </iframe>
                        </div>
                        <div class="p-4">
                            <h4 class="font-bold text-lg mb-2">Sarah's Story</h4>
                            <p class="text-sm text-gray-600">Mother of two shares her experience with our preschool program</p>
                        </div>
                    </div>
                    
                    <!-- Video 2 -->
                    <div class="bg-white rounded-2xl overflow-hidden shadow-lg">
                        <div class="relative" style="padding-bottom: 56.25%; height: 0;">
                            <iframe 
                                class="absolute top-0 left-0 w-full h-full"
                                src="https://www.youtube.com/embed/dQw4w9WgXcQ" 
                                title="Parent Testimonial 2"
                                frameborder="0" 
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                allowfullscreen>
                            </iframe>
                        </div>
                        <div class="p-4">
                            <h4 class="font-bold text-lg mb-2">A Tour of Our Facility</h4>
                            <p class="text-sm text-gray-600">Take a virtual walk through our classrooms and play areas</p>
                        </div>
                    </div>
                </div>
                
                <div class="mt-8 text-center bg-gradient-to-r from-purple-100 to-pink-100 rounded-2xl p-6">
                    <p class="text-gray-700">
                        <i class="fas fa-info-circle text-purple-600 mr-2"></i>
                        <strong>Want to add your own videos?</strong> Simply replace the YouTube embed URLs in the code with your video links.
                    </p>
                </div>
            </div>
        </div>
    </section>

    <!-- Contact & Location Section -->
    <section id="contact" class="py-20 bg-gradient-to-br from-purple-50 to-blue-50">
        <div class="container mx-auto px-4">
            <div class="text-center mb-16">
                <h2 class="text-4xl md:text-5xl font-bold text-gray-800 mb-4">
                    <i class="fas fa-map-marker-alt text-purple-600 mr-3"></i>
                    Contact & Location
                </h2>
                <p class="text-xl text-gray-600 max-w-3xl mx-auto">
                    Ready to start your child's learning journey? Get in touch with us today!
                </p>
            </div>
            
            <div class="grid md:grid-cols-2 gap-12 max-w-6xl mx-auto">
                <!-- Contact Information -->
                <div>
                    <div class="bg-white rounded-2xl p-8 shadow-lg mb-8">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">Get In Touch</h3>
                        
                        <div class="space-y-6">
                            <div class="flex items-start">
                                <i class="fas fa-phone-alt text-2xl text-purple-600 mr-4 mt-1"></i>
                                <div>
                                    <p class="font-bold text-gray-800 mb-1">Phone</p>
                                    <p class="text-gray-600">502-999-4143</p>
                                    <p class="text-sm text-gray-500">Monday-Friday, 6:30 AM - 6:00 PM</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start">
                                <i class="fas fa-envelope text-2xl text-blue-600 mr-4 mt-1"></i>
                                <div>
                                    <p class="font-bold text-gray-800 mb-1">Email</p>
                                    <p class="text-gray-600">info@learnandgrowchildcarecenter.me</p>
                                    <p class="text-sm text-gray-500">We respond within 24 hours</p>
                                </div>
                            </div>
                            
                            <div class="flex items-start">
                                <i class="fas fa-map-marker-alt text-2xl text-green-600 mr-4 mt-1"></i>
                                <div>
                                    <p class="font-bold text-gray-800 mb-1">Address</p>
                                    <p class="text-gray-600">4014 Bardstown Rd<br/>Louisville, KY 40218-2631</p>
                                    <a href="#" class="text-purple-600 text-sm hover:underline">Get Directions →</a>
                                </div>
                            </div>
                            
                            <div class="flex items-start">
                                <i class="fas fa-clock text-2xl text-yellow-600 mr-4 mt-1"></i>
                                <div>
                                    <p class="font-bold text-gray-800 mb-1">Operating Hours</p>
                                    <p class="text-gray-600">Monday - Friday: 6:30 AM - 6:00 PM</p>
                                    <p class="text-gray-600">Saturday - Sunday: Closed</p>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Social Media -->
                        <div class="mt-8 pt-8 border-t border-gray-200">
                            <p class="font-bold text-gray-800 mb-4">Follow Us</p>
                            <div class="flex space-x-4">
                                <a href="https://www.facebook.com/learnandgrowdaycarecenter" target="_blank" rel="noopener noreferrer" class="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white hover:bg-blue-700 transition">
                                    <i class="fab fa-facebook-f"></i>
                                </a>
                                <a href="#" class="w-12 h-12 bg-pink-600 rounded-full flex items-center justify-center text-white hover:bg-pink-700 transition">
                                    <i class="fab fa-instagram"></i>
                                </a>
                                <a href="#" class="w-12 h-12 bg-blue-400 rounded-full flex items-center justify-center text-white hover:bg-blue-500 transition">
                                    <i class="fab fa-twitter"></i>
                                </a>
                                <a href="#" class="w-12 h-12 bg-red-600 rounded-full flex items-center justify-center text-white hover:bg-red-700 transition">
                                    <i class="fab fa-youtube"></i>
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Schedule Tour Form -->
                <div id="schedule-tour">
                    <div class="bg-white rounded-2xl p-8 shadow-lg">
                        <h3 class="text-2xl font-bold text-gray-800 mb-6">Schedule a Tour</h3>
                        <form id="tourForm" class="space-y-4">
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Parent/Guardian Name *</label>
                                <input type="text" name="parentName" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            
                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">Email *</label>
                                    <input type="email" name="email" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                </div>
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">Phone *</label>
                                    <input type="tel" name="phone" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                </div>
                            </div>
                            
                            <div class="grid md:grid-cols-2 gap-4">
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">Child's Name *</label>
                                    <input type="text" name="childName" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                </div>
                                <div>
                                    <label class="block text-gray-700 font-semibold mb-2">Child's Age *</label>
                                    <input type="text" name="childAge" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                </div>
                            </div>
                            
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Program Interest *</label>
                                <select name="program" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                                    <option value="">Select a program</option>
                                    <option value="infant">Infant Care (6 weeks - 18 months)</option>
                                    <option value="toddler">Toddler Program (18 months - 3 years)</option>
                                    <option value="preschool">Preschool (3 - 5 years)</option>
                                    <option value="schoolage">School Age Care (5 - 12 years)</option>
                                </select>
                            </div>
                            
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Preferred Tour Date *</label>
                                <input type="date" name="tourDate" required class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600">
                            </div>
                            
                            <div>
                                <label class="block text-gray-700 font-semibold mb-2">Additional Message</label>
                                <textarea name="message" rows="3" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"></textarea>
                            </div>
                            
                            <button type="submit" class="w-full btn-primary text-white px-8 py-4 rounded-lg font-bold text-lg">
                                <i class="fas fa-calendar-check mr-2"></i>Request Tour
                            </button>
                        </form>
                    </div>
                    
                    <!-- Google Maps -->
                    <div class="mt-8 bg-white rounded-2xl overflow-hidden shadow-lg">
                        <iframe 
                            width="100%" 
                            height="300" 
                            frameborder="0" 
                            style="border:0" 
                            src="https://www.google.com/maps/embed/v1/place?key=AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8&q=4014+Bardstown+Rd,Louisville,KY+40218&zoom=15" 
                            allowfullscreen>
                        </iframe>
                    </div>
                </div>
            </div>
        </div>
    </section>

    <!-- Footer -->
    <footer class="bg-gradient-to-r from-purple-900 to-blue-900 text-white py-12">
        <div class="container mx-auto px-4">
            <div class="grid md:grid-cols-4 gap-8 mb-8">
                <!-- About -->
                <div>
                    <div class="flex items-center mb-4">
                        <i class="fas fa-graduation-cap text-3xl mr-2"></i>
                        <div>
                            <h3 class="font-bold text-lg">Learn & Grow</h3>
                            <p class="text-xs text-purple-200">Childcare Center</p>
                        </div>
                    </div>
                    <p class="text-purple-200 text-sm">
                        Transforming curiosity into a lifelong love for learning in a safe, nurturing environment.
                    </p>
                </div>
                
                <!-- Quick Links -->
                <div>
                    <h4 class="font-bold text-lg mb-4">Quick Links</h4>
                    <ul class="space-y-2 text-purple-200 text-sm">
                        <li><a href="#programs" class="hover:text-white transition">Programs</a></li>
                        <li><a href="#safety" class="hover:text-white transition">Safety</a></li>
                        <li><a href="#approach" class="hover:text-white transition">Our Approach</a></li>
                        <li><a href="#team" class="hover:text-white transition">Our Team</a></li>
                        <li><a href="#enrollment" class="hover:text-white transition">Enrollment</a></li>
                    </ul>
                </div>
                
                <!-- Resources -->
                <div>
                    <h4 class="font-bold text-lg mb-4">Resources</h4>
                    <ul class="space-y-2 text-purple-200 text-sm">
                        <li><a href="#" class="hover:text-white transition">Parent Handbook</a></li>
                        <li><a href="#" class="hover:text-white transition">Calendar & Events</a></li>
                        <li><a href="#" class="hover:text-white transition">Forms & Documents</a></li>
                        <li><a href="#" class="hover:text-white transition">FAQ</a></li>
                        <li><a href="#" class="hover:text-white transition">Privacy Policy</a></li>
                    </ul>
                </div>
                
                <!-- Contact -->
                <div>
                    <h4 class="font-bold text-lg mb-4">Contact</h4>
                    <ul class="space-y-2 text-purple-200 text-sm">
                        <li><i class="fas fa-phone mr-2"></i>502-999-4143</li>
                        <li><i class="fas fa-envelope mr-2"></i>info@learnandgrowchildcarecenter.me</li>
                        <li><i class="fas fa-map-marker-alt mr-2"></i>4014 Bardstown Rd<br/>Louisville, KY 40218-2631</li>
                    </ul>
                </div>
            </div>
            
            <div class="border-t border-purple-700 pt-8 text-center text-purple-200 text-sm">
                <p>&copy; 2025 Learn and Grow Childcare Center. All rights reserved. | Licensed & Accredited</p>
            </div>
        </div>
    </footer>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <script>
        // Mobile Menu Toggle
        function toggleMobileMenu() {
            const menu = document.getElementById('mobileMenu');
            menu.classList.toggle('active');
        }
        
        // Smooth Scroll
        function scrollToSection(id) {
            const element = document.getElementById(id);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }
        
        // Program Details Modal (placeholder)
        function openProgramDetails(program) {
            alert('Program details for: ' + program + '\\n\\nIn a full implementation, this would open a detailed modal with comprehensive information about the selected program.');
        }
        
        // Enrollment Modal Functions
        function openEnrollmentModal() {
            const modal = document.getElementById('enrollmentModal');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
        
        function closeEnrollmentModal() {
            const modal = document.getElementById('enrollmentModal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scrolling
        }
        
        // Employment Modal Functions
        function openEmploymentModal() {
            const modal = document.getElementById('employmentModal');
            modal.style.display = 'flex';
            document.body.style.overflow = 'hidden'; // Prevent background scrolling
        }
        
        function closeEmploymentModal() {
            const modal = document.getElementById('employmentModal');
            modal.style.display = 'none';
            document.body.style.overflow = 'auto'; // Restore scrolling
        }
        
        // Close modals with Escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeEnrollmentModal();
                closeEmploymentModal();
                closeLightbox();
            }
        });
        
        // Gallery Functions
        const galleryImages = [
            { src: '/gallery/classroom-infant.jpg', title: 'Infant & Toddler Classroom', caption: 'Safe, nurturing environment with engaging learning materials' },
            { src: '/gallery/science-activity.jpg', title: 'Science Activities', caption: 'Hands-on learning with colorful experiments and discovery' },
            { src: '/gallery/story-time.jpg', title: 'Story Time', caption: 'Building literacy skills through engaging storytelling' },
            { src: '/gallery/arts-crafts.jpg', title: 'Arts & Crafts', caption: 'Creative expression with painting and colorful projects' },
            { src: '/gallery/meal-time-1.jpg', title: 'Healthy Snack Time', caption: 'Nutritious meals with fresh fruits and vegetables daily' },
            { src: '/gallery/meal-time-2.jpg', title: 'Family Meal Time', caption: 'Building social skills during mealtime together' },
            { src: '/gallery/birthday-celebration.jpg', title: 'Birthday Celebrations', caption: 'Creating special memories with festive celebrations' },
            { src: '/gallery/holiday-event.jpg', title: 'Holiday Events', caption: 'Celebrating traditions with crafts and family activities' },
            { src: '/gallery/parent-teacher.jpg', title: 'Parent-Teacher Partnership', caption: 'Strong family involvement and communication' },
            { src: '/gallery/team-photo.jpg', title: 'Our Amazing Team', caption: 'Dedicated, experienced, and caring early childhood educators' },
            { src: '/gallery/outdoor-exploration.jpg', title: 'Outdoor Exploration', caption: 'Nature-based learning and outdoor discovery activities' },
            { src: '/gallery/playground-fun.jpg', title: 'Playground Fun', caption: 'Safe playground with slides, swings, and active play' }
        ];
        
        let currentImageIndex = 0;
        
        function showGalleryCategory(category) {
            // Update tab styles
            const tabs = document.querySelectorAll('[id^="gallery-tab-"]');
            tabs.forEach(tab => {
                tab.className = 'gallery-tab px-6 py-3 rounded-full font-semibold transition-all hover:scale-105';
            });
            document.getElementById('gallery-tab-' + category).className = 'gallery-tab-active px-6 py-3 rounded-full font-semibold transition-all hover:scale-105';
            
            // Filter gallery items
            const items = document.querySelectorAll('.gallery-item');
            items.forEach(item => {
                if (category === 'all') {
                    item.classList.remove('hidden');
                } else {
                    if (item.classList.contains(category)) {
                        item.classList.remove('hidden');
                    } else {
                        item.classList.add('hidden');
                    }
                }
            });
        }
        
        function openLightbox(index) {
            currentImageIndex = index;
            const lightbox = document.getElementById('lightbox');
            const img = document.getElementById('lightboxImage');
            const caption = document.getElementById('lightboxCaption');
            
            img.src = galleryImages[index].src;
            caption.innerHTML = '<strong>' + galleryImages[index].title + '</strong><br/>' + galleryImages[index].caption;
            
            lightbox.style.display = 'flex';
            document.body.style.overflow = 'hidden';
        }
        
        function closeLightbox() {
            const lightbox = document.getElementById('lightbox');
            lightbox.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
        
        function nextImage() {
            currentImageIndex = (currentImageIndex + 1) % galleryImages.length;
            const img = document.getElementById('lightboxImage');
            const caption = document.getElementById('lightboxCaption');
            
            img.src = galleryImages[currentImageIndex].src;
            caption.innerHTML = '<strong>' + galleryImages[currentImageIndex].title + '</strong><br/>' + galleryImages[currentImageIndex].caption;
        }
        
        function previousImage() {
            currentImageIndex = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
            const img = document.getElementById('lightboxImage');
            const caption = document.getElementById('lightboxCaption');
            
            img.src = galleryImages[currentImageIndex].src;
            caption.innerHTML = '<strong>' + galleryImages[currentImageIndex].title + '</strong><br/>' + galleryImages[currentImageIndex].caption;
        }
        
        // Keyboard navigation for lightbox
        document.addEventListener('keydown', (e) => {
            const lightbox = document.getElementById('lightbox');
            if (lightbox.style.display === 'flex') {
                if (e.key === 'ArrowRight') nextImage();
                if (e.key === 'ArrowLeft') previousImage();
            }
        });
        
        // Tour Form Submission
        document.getElementById('tourForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                const response = await axios.post('/api/schedule-tour', data);
                
                if (response.data.success) {
                    closeEnrollmentModal();
                    alert('Thank you! Your tour request has been received. We will contact you within 24 hours to confirm your tour date and time.');
                    e.target.reset();
                }
            } catch (error) {
                alert('There was an error submitting your request. Please call us at 502-999-4143 or try again later.');
                console.error('Error:', error);
            }
        });
        
        // Enrollment Form Submission
        document.getElementById('enrollmentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                const response = await axios.post('/api/enrollment-application', data);
                
                if (response.data.success) {
                    closeEnrollmentModal();
                    alert('Thank you for your enrollment application! We have received your information and will review it carefully. Our admissions team will contact you within 24-48 hours to discuss next steps.\\n\\nApplication Summary:\\n- Parent: ' + data.parentFirstName + ' ' + data.parentLastName + '\\n- Child: ' + data.childFirstName + ' ' + data.childLastName + '\\n- Program: ' + data.program + '\\n- Start Date: ' + data.startDate);
                    e.target.reset();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch (error) {
                alert('There was an error submitting your application. Please call us at 502-999-4143 or email info@learnandgrowchildcarecenter.me for assistance.');
                console.error('Error:', error);
            }
        });
        
        // Employment Form Submission
        document.getElementById('employmentForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const formData = new FormData(e.target);
            const data = Object.fromEntries(formData);
            
            try {
                const response = await axios.post('/api/employment-application', data);
                
                if (response.data.success) {
                    closeEnrollmentModal();
                    closeEmploymentModal();
                    alert('✅ Thank you for your interest in joining our team! We have received your employment application.\\n\\n📧 A confirmation email has been sent to ' + data.email + '\\n\\nOur HR team will review your application and contact you within 5-7 business days if your qualifications match our current openings.\\n\\nNext Steps:\\n1. Background check authorization (if selected)\\n2. Interview scheduling\\n3. Reference checks\\n\\nWe appreciate your interest in Learn & Grow Childcare Center!');
                    e.target.reset();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                }
            } catch (error) {
                alert('There was an error submitting your application. Please email your resume directly to info@learnandgrowchildcarecenter.me or call 502-999-4143.');
                console.error('Error:', error);
            }
        });
        
        // Scroll animations
        const observerOptions = {
            threshold: 0.1,
            rootMargin: '0px 0px -50px 0px'
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }
            });
        }, observerOptions);
        
        // Observe animated elements
        document.addEventListener('DOMContentLoaded', () => {
            const animatedElements = document.querySelectorAll('.card-hover, .animate-fade-in-up');
            animatedElements.forEach(el => {
                el.style.opacity = '0';
                el.style.transform = 'translateY(30px)';
                el.style.transition = 'opacity 0.6s ease-out, transform 0.6s ease-out';
                observer.observe(el);
            });
        });
    </script>
</body>
</html>
  `)
})

// ===== ADMIN PANEL HTML GENERATORS =====

function getAdminLoginPage(error = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - Learn & Grow Childcare</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-purple-100 to-blue-100 min-h-screen flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
            <i class="fas fa-shield-alt text-6xl text-purple-600 mb-4"></i>
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Admin Login</h1>
            <p class="text-gray-600">Learn & Grow Childcare Center</p>
        </div>
        
        ${error ? `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <i class="fas fa-exclamation-triangle mr-2"></i>${error}
        </div>
        ` : ''}
        
        <form method="POST" action="/admin/login" class="space-y-6">
            <div>
                <label class="block text-gray-700 font-semibold mb-2">
                    <i class="fas fa-lock mr-2"></i>Password
                </label>
                <input 
                    type="password" 
                    name="password" 
                    required 
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                    placeholder="Enter admin password"
                    autofocus
                >
            </div>
            
            <button 
                type="submit" 
                class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-blue-700 transition"
            >
                <i class="fas fa-sign-in-alt mr-2"></i>Login
            </button>
        </form>
        
        <div class="mt-6 text-center">
            <a href="/admin/forgot-password" class="text-sm text-purple-600 hover:text-purple-800 transition">
                <i class="fas fa-key mr-2"></i>Forgot Password?
            </a>
        </div>
        
        <div class="mt-6 text-center text-sm text-gray-600">
            <p>Default password: <code class="bg-gray-200 px-2 py-1 rounded">admin123</code></p>
            <p class="mt-2">Change this in Cloudflare environment variables</p>
        </div>
        
        <div class="mt-6 text-center">
            <a href="/" class="text-purple-600 hover:text-purple-800 transition">
                <i class="fas fa-arrow-left mr-2"></i>Back to website
            </a>
        </div>
    </div>
</body>
</html>
  `
}

function getForgotPasswordPage(message = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Forgot Password - Learn & Grow Childcare</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-purple-100 to-blue-100 min-h-screen flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
            <i class="fas fa-key text-6xl text-purple-600 mb-4"></i>
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Forgot Password</h1>
            <p class="text-gray-600">Reset your admin password</p>
        </div>
        
        ${message ? `
        <div class="bg-${message.includes('✅') ? 'green' : 'red'}-100 border border-${message.includes('✅') ? 'green' : 'red'}-400 text-${message.includes('✅') ? 'green' : 'red'}-700 px-4 py-3 rounded-lg mb-6">
            ${message}
        </div>
        ` : ''}
        
        <form method="POST" action="/admin/forgot-password" class="space-y-6">
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p class="text-sm text-gray-700">
                    <i class="fas fa-info-circle text-blue-600 mr-2"></i>
                    A password reset link will be sent to <strong>LearnandGrowCC@gmail.com</strong>
                </p>
            </div>
            
            <button 
                type="submit" 
                class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-blue-700 transition"
            >
                <i class="fas fa-paper-plane mr-2"></i>Send Reset Link
            </button>
        </form>
        
        <div class="mt-6 text-center">
            <a href="/admin/login" class="text-purple-600 hover:text-purple-800 transition">
                <i class="fas fa-arrow-left mr-2"></i>Back to Login
            </a>
        </div>
    </div>
</body>
</html>
  `
}

function getResetPasswordPage(token = '', error = '') {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - Learn & Grow Childcare</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body class="bg-gradient-to-br from-purple-100 to-blue-100 min-h-screen flex items-center justify-center">
    <div class="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        <div class="text-center mb-8">
            <i class="fas fa-lock text-6xl text-purple-600 mb-4"></i>
            <h1 class="text-3xl font-bold text-gray-800 mb-2">Reset Password</h1>
            <p class="text-gray-600">Create your new password</p>
        </div>
        
        ${error ? `
        <div class="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg mb-6">
            <i class="fas fa-exclamation-triangle mr-2"></i>${error}
        </div>
        ` : ''}
        
        <form method="POST" action="/admin/reset-password" class="space-y-6">
            <input type="hidden" name="token" value="${token}">
            
            <div>
                <label class="block text-gray-700 font-semibold mb-2">
                    <i class="fas fa-lock mr-2"></i>New Password
                </label>
                <input 
                    type="password" 
                    name="newPassword" 
                    required 
                    minlength="8"
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                    placeholder="At least 8 characters"
                    autofocus
                >
            </div>
            
            <div>
                <label class="block text-gray-700 font-semibold mb-2">
                    <i class="fas fa-lock mr-2"></i>Confirm Password
                </label>
                <input 
                    type="password" 
                    name="confirmPassword" 
                    required 
                    minlength="8"
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-600"
                    placeholder="Re-enter your password"
                >
            </div>
            
            <div class="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p class="text-sm text-gray-700">
                    <i class="fas fa-info-circle text-yellow-600 mr-2"></i>
                    Your new password will be sent to <strong>LearnandGrowCC@gmail.com</strong> for your records.
                </p>
            </div>
            
            <button 
                type="submit" 
                class="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:from-purple-700 hover:to-blue-700 transition"
            >
                <i class="fas fa-check mr-2"></i>Reset Password
            </button>
        </form>
        
        <div class="mt-6 text-center">
            <a href="/admin/login" class="text-purple-600 hover:text-purple-800 transition">
                <i class="fas fa-arrow-left mr-2"></i>Back to Login
            </a>
        </div>
    </div>
</body>
</html>
  `
}

async function getAdminDashboard(env: Bindings) {
  // Get counts for each type
  const tourIndex = await env.FORMS_STORAGE?.get('index:tour')
  const enrollmentIndex = await env.FORMS_STORAGE?.get('index:enrollment')
  const employmentIndex = await env.FORMS_STORAGE?.get('index:employment')
  
  const tourCount = tourIndex ? JSON.parse(tourIndex).length : 0
  const enrollmentCount = enrollmentIndex ? JSON.parse(enrollmentIndex).length : 0
  const employmentCount = employmentIndex ? JSON.parse(employmentIndex).length : 0
  
  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Dashboard - Learn & Grow Childcare</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://cdn.jsdelivr.net/npm/@fortawesome/fontawesome-free@6.4.0/css/all.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/axios@1.6.0/dist/axios.min.js"></script>
    <style>
        .tab-active {
            border-bottom: 3px solid #9333ea;
            color: #9333ea;
        }
    </style>
</head>
<body class="bg-gray-50">
    <!-- Header -->
    <header class="bg-gradient-to-r from-purple-600 to-blue-600 text-white py-4 shadow-lg">
        <div class="container mx-auto px-4 flex justify-between items-center">
            <div class="flex items-center">
                <i class="fas fa-graduation-cap text-3xl mr-3"></i>
                <div>
                    <h1 class="text-2xl font-bold">Learn & Grow Admin</h1>
                    <p class="text-sm text-purple-200">Childcare Management Dashboard</p>
                </div>
            </div>
            <div>
                <a href="/admin/logout" class="bg-white text-purple-600 px-4 py-2 rounded-lg font-semibold hover:bg-purple-100 transition">
                    <i class="fas fa-sign-out-alt mr-2"></i>Logout
                </a>
            </div>
        </div>
    </header>
    
    <!-- Main Content -->
    <div class="container mx-auto px-4 py-8">
        <!-- Stats Cards -->
        <div class="grid md:grid-cols-3 gap-6 mb-8">
            <!-- Tour Requests -->
            <div class="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition" onclick="showTab('tour')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 text-sm font-semibold mb-1">Tour Requests</p>
                        <h3 class="text-4xl font-bold text-purple-600">${tourCount}</h3>
                        <p class="text-gray-500 text-xs mt-2">Click to view details</p>
                    </div>
                    <div class="bg-purple-100 rounded-full p-4">
                        <i class="fas fa-calendar-check text-3xl text-purple-600"></i>
                    </div>
                </div>
            </div>
            
            <!-- Enrollment Applications -->
            <div class="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition" onclick="showTab('enrollment')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 text-sm font-semibold mb-1">Enrollments</p>
                        <h3 class="text-4xl font-bold text-blue-600">${enrollmentCount}</h3>
                        <p class="text-gray-500 text-xs mt-2">Click to view details</p>
                    </div>
                    <div class="bg-blue-100 rounded-full p-4">
                        <i class="fas fa-user-plus text-3xl text-blue-600"></i>
                    </div>
                </div>
            </div>
            
            <!-- Employment Applications -->
            <div class="bg-white rounded-xl shadow-lg p-6 cursor-pointer hover:shadow-xl transition" onclick="showTab('employment')">
                <div class="flex items-center justify-between">
                    <div>
                        <p class="text-gray-600 text-sm font-semibold mb-1">Job Applications</p>
                        <h3 class="text-4xl font-bold text-green-600">${employmentCount}</h3>
                        <p class="text-gray-500 text-xs mt-2">Click to view details</p>
                    </div>
                    <div class="bg-green-100 rounded-full p-4">
                        <i class="fas fa-briefcase text-3xl text-green-600"></i>
                    </div>
                </div>
            </div>
        </div>
        
        <!-- Tabs -->
        <div class="bg-white rounded-xl shadow-lg overflow-hidden">
            <div class="flex border-b border-gray-200">
                <button onclick="showTab('tour')" id="tab-tour" class="flex-1 px-6 py-4 text-center font-semibold hover:bg-gray-50 transition tab-active">
                    <i class="fas fa-calendar-check mr-2"></i>Tour Requests
                </button>
                <button onclick="showTab('enrollment')" id="tab-enrollment" class="flex-1 px-6 py-4 text-center font-semibold hover:bg-gray-50 transition">
                    <i class="fas fa-user-plus mr-2"></i>Enrollment Applications
                </button>
                <button onclick="showTab('employment')" id="tab-employment" class="flex-1 px-6 py-4 text-center font-semibold hover:bg-gray-50 transition">
                    <i class="fas fa-briefcase mr-2"></i>Employment Applications
                </button>
            </div>
            
            <!-- Tab Content -->
            <div class="p-6">
                <div id="content-tour" class="tab-content">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-800">Tour Requests</h2>
                        <button onclick="refreshData('tour')" class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition">
                            <i class="fas fa-sync-alt mr-2"></i>Refresh
                        </button>
                    </div>
                    <div id="submissions-tour" class="space-y-4">
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                            <p>Loading submissions...</p>
                        </div>
                    </div>
                </div>
                
                <div id="content-enrollment" class="tab-content hidden">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-800">Enrollment Applications</h2>
                        <button onclick="refreshData('enrollment')" class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition">
                            <i class="fas fa-sync-alt mr-2"></i>Refresh
                        </button>
                    </div>
                    <div id="submissions-enrollment" class="space-y-4">
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                            <p>Loading submissions...</p>
                        </div>
                    </div>
                </div>
                
                <div id="content-employment" class="tab-content hidden">
                    <div class="flex justify-between items-center mb-6">
                        <h2 class="text-2xl font-bold text-gray-800">Employment Applications</h2>
                        <button onclick="refreshData('employment')" class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition">
                            <i class="fas fa-sync-alt mr-2"></i>Refresh
                        </button>
                    </div>
                    <div id="submissions-employment" class="space-y-4">
                        <div class="text-center py-8 text-gray-500">
                            <i class="fas fa-spinner fa-spin text-4xl mb-4"></i>
                            <p>Loading submissions...</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <!-- Modal for viewing submission details -->
    <div id="submissionModal" class="fixed inset-0 bg-black bg-opacity-50 hidden items-center justify-center z-50">
        <div class="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
            <div class="sticky top-0 bg-white border-b border-gray-200 p-6 flex justify-between items-center">
                <h3 class="text-2xl font-bold text-gray-800" id="modalTitle">Submission Details</h3>
                <button onclick="closeModal()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-2xl"></i>
                </button>
            </div>
            <div class="p-6" id="modalContent">
                <!-- Content will be inserted here -->
            </div>
        </div>
    </div>
    
    <script>
        let currentTab = 'tours';
        
        function showTab(tab) {
            // Update tab buttons
            document.querySelectorAll('[id^="tab-"]').forEach(btn => {
                btn.classList.remove('tab-active');
            });
            document.getElementById('tab-' + tab).classList.add('tab-active');
            
            // Update content
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.add('hidden');
            });
            document.getElementById('content-' + tab).classList.remove('hidden');
            
            currentTab = tab;
            loadSubmissions(tab);
        }
        
        async function loadSubmissions(type) {
            try {
                const response = await axios.get('/admin/api/submissions/' + type);
                const submissions = response.data.submissions;
                
                const container = document.getElementById('submissions-' + type);
                
                if (submissions.length === 0) {
                    container.innerHTML = \`
                        <div class="text-center py-12 text-gray-500">
                            <i class="fas fa-inbox text-6xl mb-4"></i>
                            <p class="text-xl font-semibold">No submissions yet</p>
                            <p class="text-sm mt-2">New submissions will appear here</p>
                        </div>
                    \`;
                    return;
                }
                
                container.innerHTML = submissions.map(sub => createSubmissionCard(sub)).join('');
            } catch (error) {
                console.error('Error loading submissions:', error);
                document.getElementById('submissions-' + type).innerHTML = \`
                    <div class="text-center py-12 text-red-500">
                        <i class="fas fa-exclamation-triangle text-6xl mb-4"></i>
                        <p class="text-xl font-semibold">Error loading submissions</p>
                        <p class="text-sm mt-2">\${error.message}</p>
                    </div>
                \`;
            }
        }
        
        function createSubmissionCard(submission) {
            const date = new Date(submission.timestamp).toLocaleString();
            const data = submission.data;
            let title, subtitle, statusColor;
            
            if (submission.type === 'tour') {
                title = data.parentName;
                subtitle = \`Child: \${data.childName} (Age: \${data.childAge}) | Tour Date: \${data.tourDate}\`;
                statusColor = 'purple';
            } else if (submission.type === 'enrollment') {
                title = \`\${data.childFirstName} \${data.childLastName}\`;
                subtitle = \`Parent: \${data.parentFirstName} \${data.parentLastName} | Program: \${data.program}\`;
                statusColor = 'blue';
            } else {
                title = \`\${data.firstName} \${data.lastName}\`;
                subtitle = \`Position: \${data.position} | Experience: \${data.experience}\`;
                statusColor = 'green';
            }
            
            const statusBadge = submission.status === 'new' ? 
                \`<span class="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-semibold"><i class="fas fa-circle text-xs mr-1"></i>New</span>\` :
                submission.status === 'reviewed' ?
                \`<span class="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm font-semibold"><i class="fas fa-eye mr-1"></i>Reviewed</span>\` :
                \`<span class="bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm font-semibold"><i class="fas fa-check mr-1"></i>Completed</span>\`;
            
            return \`
                <div class="bg-gray-50 rounded-xl p-6 border-l-4 border-\${statusColor}-500 hover:shadow-lg transition cursor-pointer" onclick="viewSubmission('\${submission.id}')">
                    <div class="flex justify-between items-start mb-4">
                        <div class="flex-1">
                            <h3 class="text-xl font-bold text-gray-800 mb-1">\${title}</h3>
                            <p class="text-gray-600 text-sm">\${subtitle}</p>
                            <p class="text-gray-500 text-xs mt-2">
                                <i class="fas fa-clock mr-1"></i>\${date}
                            </p>
                        </div>
                        <div>
                            \${statusBadge}
                        </div>
                    </div>
                    <div class="flex gap-2">
                        <button onclick="event.stopPropagation(); viewSubmission('\${submission.id}')" class="flex-1 bg-\${statusColor}-100 text-\${statusColor}-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-\${statusColor}-200 transition">
                            <i class="fas fa-eye mr-2"></i>View Details
                        </button>
                        <button onclick="event.stopPropagation(); updateStatus('\${submission.id}', 'reviewed')" class="bg-yellow-100 text-yellow-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-yellow-200 transition">
                            <i class="fas fa-check mr-2"></i>Mark Reviewed
                        </button>
                        <button onclick="event.stopPropagation(); deleteSubmission('\${submission.id}')" class="bg-red-100 text-red-700 px-4 py-2 rounded-lg text-sm font-semibold hover:bg-red-200 transition">
                            <i class="fas fa-trash mr-2"></i>Delete
                        </button>
                    </div>
                </div>
            \`;
        }
        
        async function viewSubmission(id) {
            try {
                const response = await axios.get('/admin/api/submission/' + id);
                const submission = response.data.submission;
                
                const modal = document.getElementById('submissionModal');
                const modalTitle = document.getElementById('modalTitle');
                const modalContent = document.getElementById('modalContent');
                
                modalTitle.textContent = submission.type.charAt(0).toUpperCase() + submission.type.slice(1) + ' Details';
                modalContent.innerHTML = formatSubmissionDetails(submission);
                
                modal.classList.remove('hidden');
                modal.classList.add('flex');
            } catch (error) {
                alert('Error loading submission details: ' + error.message);
            }
        }
        
        function formatSubmissionDetails(submission) {
            const data = submission.data;
            const date = new Date(submission.timestamp).toLocaleString();
            
            let html = \`
                <div class="space-y-6">
                    <div class="bg-blue-50 rounded-lg p-4">
                        <p class="text-sm text-gray-600"><strong>Submission ID:</strong> \${submission.id}</p>
                        <p class="text-sm text-gray-600"><strong>Submitted:</strong> \${date}</p>
                        <p class="text-sm text-gray-600"><strong>Status:</strong> \${submission.status}</p>
                    </div>
            \`;
            
            // Format based on type
            for (const [key, value] of Object.entries(data)) {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                html += \`
                    <div class="border-b border-gray-200 pb-3">
                        <p class="text-sm font-semibold text-gray-700 mb-1">\${label}</p>
                        <p class="text-gray-800">\${value || 'Not provided'}</p>
                    </div>
                \`;
            }
            
            html += \`
                    <div class="flex gap-3 pt-4">
                        <button onclick="updateStatus('\${submission.id}', 'reviewed')" class="flex-1 bg-yellow-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-yellow-600 transition">
                            <i class="fas fa-check mr-2"></i>Mark as Reviewed
                        </button>
                        <button onclick="updateStatus('\${submission.id}', 'completed')" class="flex-1 bg-green-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-600 transition">
                            <i class="fas fa-check-double mr-2"></i>Mark as Completed
                        </button>
                        <button onclick="deleteSubmission('\${submission.id}')" class="bg-red-500 text-white px-6 py-3 rounded-lg font-semibold hover:bg-red-600 transition">
                            <i class="fas fa-trash mr-2"></i>Delete
                        </button>
                    </div>
                </div>
            \`;
            
            return html;
        }
        
        async function updateStatus(id, status) {
            try {
                await axios.post(\`/admin/api/submission/\${id}/status\`, { status });
                alert('Status updated successfully!');
                closeModal();
                refreshData(currentTab);
            } catch (error) {
                alert('Error updating status: ' + error.message);
            }
        }
        
        async function deleteSubmission(id) {
            if (!confirm('Are you sure you want to delete this submission? This cannot be undone.')) {
                return;
            }
            
            try {
                await axios.delete('/admin/api/submission/' + id);
                alert('Submission deleted successfully!');
                closeModal();
                refreshData(currentTab);
            } catch (error) {
                alert('Error deleting submission: ' + error.message);
            }
        }
        
        function refreshData(type) {
            loadSubmissions(type);
        }
        
        function closeModal() {
            const modal = document.getElementById('submissionModal');
            modal.classList.add('hidden');
            modal.classList.remove('flex');
        }
        
        // Initialize
        showTab('tour');
        
        // Auto-refresh every 30 seconds
        setInterval(() => {
            loadSubmissions(currentTab);
        }, 30000);
    </script>
</body>
</html>
  `
}

export default app


