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
        return $this->subject('Email Verification Code - SIA System')
                    ->view('emails.verification-code')
                    ->with([
                        'code' => $this->code,
                        'email' => $this->email,
                    ]);
    }
}

