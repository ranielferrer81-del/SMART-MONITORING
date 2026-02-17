<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Email Verification Code</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #dc2626; color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0;">
        <h1 style="margin: 0; font-size: 24px;">SIA System</h1>
    </div>
    
    <div style="background-color: #f9fafb; padding: 30px; border-radius: 0 0 8px 8px; border: 1px solid #e5e7eb;">
        <h2 style="color: #1f2937; margin-top: 0;">Email Verification Code</h2>
        
        <p style="color: #4b5563; font-size: 16px;">
            Hello,
        </p>
        
        <p style="color: #4b5563; font-size: 16px;">
            You have requested to log in to the SIA System. Please use the following verification code to complete your login:
        </p>
        
        <div style="background-color: white; border: 2px solid #dc2626; border-radius: 8px; padding: 20px; text-align: center; margin: 30px 0;">
            <div style="font-size: 36px; font-weight: bold; color: #dc2626; letter-spacing: 8px; font-family: 'Courier New', monospace;">
                {{ $code }}
            </div>
        </div>
        
        <p style="color: #4b5563; font-size: 16px;">
            This code will expire in <strong>10 minutes</strong>. Please do not share this code with anyone.
        </p>
        
        <p style="color: #6b7280; font-size: 14px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            If you did not request this code, please ignore this email or contact support if you have concerns.
        </p>
    </div>
    
    <div style="text-align: center; margin-top: 20px; color: #9ca3af; font-size: 12px;">
        <p>© {{ date('Y') }} SIA System. All rights reserved.</p>
    </div>
</body>
</html>

