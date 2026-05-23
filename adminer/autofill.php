<?php

class AdminerAutofillPlugin extends Adminer\Plugin {
    private function replaceFirst(string $search, string $replace, string $subject): string {
        $pos = strpos($subject, $search);
        if ($pos === false) {
            return $subject;
        }

        return substr_replace($subject, $replace, $pos, strlen($search));
    }

    public function loginFormField($name, $heading, $value): string {
        if ($name === 'driver') {
            $value = str_replace('value="server" selected', 'value="server"', $value);
            $value = str_replace('value="pgsql">', 'value="pgsql" selected>', $value);
        }

        if ($name === 'server') {
            $value = preg_replace('/value="[^"]*"/', 'value="postgres"', $value, 1) ?: $value;
        }

        if ($name === 'username') {
            $value = preg_replace('/value="[^"]*"/', 'value="bingo"', $value, 1) ?: $value;
        }

        if ($name === 'password') {
            $value = $this->replaceFirst('name="auth[password]"', 'name="auth[password]" value="bingo"', $value);
        }

        if ($name === 'db') {
            $value = preg_replace('/value="[^"]*"/', 'value="bingo"', $value, 1) ?: $value;
        }

        return $heading . $value . "\n";
    }
}

return new AdminerAutofillPlugin();
