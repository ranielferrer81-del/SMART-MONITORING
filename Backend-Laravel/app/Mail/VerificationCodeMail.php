<?php

namespace App\Mail;

use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Queue\SerializesModels;

class VerificationCodeMail extends Mailable
{
    use Queueable, SerializesModels;

    public $code;
    public $email;

    /**
     * Create a new message instance.
     */
    public function __construct($code, $email)
    {
        $this->code = $code;
        $this->email = $email;
    }

    /**
     * Build the message.
     */
    public function build()
    {
        $safe = htmlspecialchars((string) $this->code, ENT_QUOTES, 'UTF-8');
        $html = '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:Arial,sans-serif">'
            .'<p>Your SIA verification code is:</p>'
            .'<p style="font-size:32px;font-weight:bold;color:#dc2626;letter-spacing:8px">'.$safe.'</p>'
            .'<p style="color:#666">This code expires in 10 minutes.</p></body></html>';

        return $this->subject('Email Verification Code - SIA System')->html($html);
    }
}

