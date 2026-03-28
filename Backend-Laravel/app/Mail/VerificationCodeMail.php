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

    /** When set (e.g. Resend), forces From so the envelope matches a verified domain in Resend. */
    public $fromAddressOverride;

    public $fromNameOverride;

    /**
     * Create a new message instance.
     */
    public function __construct($code, $email, $fromAddressOverride = null, $fromNameOverride = null)
    {
        $this->code = $code;
        $this->email = $email;
        $this->fromAddressOverride = $fromAddressOverride;
        $this->fromNameOverride = $fromNameOverride;
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

        $brand = config('app.name', 'SIA');
        $from = (string) config('mail.from.address', '');
        $name = (string) config('mail.from.name', 'SIA System');

        $m = $this
            ->subject($brand.': Your verification code (login)')
            ->html($html);

        $override = $this->fromAddressOverride;
        if ($override !== null && $override !== '' && ! str_contains(strtolower((string) $override), 'example.com')) {
            $n = $this->fromNameOverride;
            if ($n === null || $n === '') {
                $n = $name;
            }

            return $m->from((string) $override, (string) $n)->replyTo((string) $override, (string) $n);
        }

        if ($from !== '') {
            $m->replyTo($from, $name);
        }

        return $m;
    }
}

