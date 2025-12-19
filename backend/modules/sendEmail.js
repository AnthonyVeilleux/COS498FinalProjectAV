const nodemailer = require('nodemailer');

// Email configuration
const transporter = nodemailer.createTransport({
  service: 'gmail', // You can change this to your email provider
  auth: {
    user: process.env.GMAIL_USER || process.env.EMAIL_USER || 'your-email@gmail.com',
    pass: process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || 'your-app-password'
  }
});

// Function to send a poke email
const sendPokeEmail = async (recipientEmail = 'anthony.veilleux@maine.edu') => {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER || process.env.EMAIL_USER || 'your-email@gmail.com',
      to: recipientEmail,
      subject: 'Poke! 👋',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333; text-align: center;">👋 Poke!</h2>
          <p style="color: #666; font-size: 16px; text-align: center;">You've been poked!</p>
          <div style="text-align: center; margin-top: 20px;">
            <span style="font-size: 48px;">🥳</span>
          </div>
          <p style="color: #999; font-size: 12px; text-align: center; margin-top: 20px;">
            Sent from the Wild West Forum
          </p>
        </div>
      `,
      text: 'Poke! You\'ve been poked! 👋'
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Poke email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending poke email:', error);
    return { success: false, error: error.message };
  }
};

// Test email configuration
const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('Email server connection verified');
    return true;
  } catch (error) {
    console.error('Email server connection failed:', error.message);
    return false;
  }
};

// Function to send a password reset email
const sendPasswordResetEmail = async (recipientEmail, resetToken, expirationTime) => {
  try {
    const resetUrl = `https://goob.site/api/auth/reset-password?token=${resetToken}`;
    const expirationDate = new Date(expirationTime).toLocaleString();
    
    const mailOptions = {
      from: process.env.GMAIL_USER || process.env.EMAIL_USER || 'your-email@gmail.com',
      to: recipientEmail,
      subject: '🔒 Password Reset Request - Epic Forum',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8f9fa;">
          <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
            <h2 style="color: #2c3e50; text-align: center; margin-bottom: 20px;">🔒 Password Reset Request</h2>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">Hello,</p>
            
            <p style="color: #555; font-size: 16px; line-height: 1.6;">
              We received a request to reset your password for your Epic Forum account. 
              If you made this request, please click the button below to reset your password:
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 15px 30px;
                text-decoration: none;
                border-radius: 25px;
                font-weight: bold;
                font-size: 16px;
                display: inline-block;
                box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
              ">Reset My Password</a>
            </div>
            
            <div style="background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="color: #856404; font-size: 14px; margin: 0;">
                <strong>⏰ Important:</strong> This reset link will expire on <strong>${expirationDate}</strong> (1 hour from now).
              </p>
            </div>
            
            <p style="color: #555; font-size: 14px; line-height: 1.6;">
              If the button doesn't work, you can copy and paste this link into your browser:
            </p>
            <p style="word-break: break-all; background: #f8f9fa; padding: 10px; border-radius: 5px; font-size: 12px;">
              ${resetUrl}
            </p>
            
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
            
            <p style="color: #777; font-size: 12px; line-height: 1.4;">
              <strong>Security Notice:</strong> If you did not request this password reset, please ignore this email. 
              Your password will remain unchanged. For your security, this link can only be used once.
            </p>
            
            <div style="text-align: center; margin-top: 20px;">
              <p style="color: #999; font-size: 12px;">
                Sent from Epic Forum Security Team<br>
                This is an automated message, please do not reply.
              </p>
            </div>
          </div>
        </div>
      `,
      text: `
Password Reset Request - Epic Forum

Hello,

We received a request to reset your password for your Epic Forum account.

To reset your password, please visit this link:
${resetUrl}

This link will expire on ${expirationDate} (1 hour from now).

If you did not request this password reset, please ignore this email.

Epic Forum Security Team
      `
    };

    const result = await transporter.sendMail(mailOptions);
    console.log('Password reset email sent successfully:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPokeEmail,
  sendPasswordResetEmail,
  testEmailConnection
};