<?php
declare(strict_types=1);

/**
 * Copy this file to api/firebase-config.local.php and set a service-account
 * JSON file stored OUTSIDE C:\xampp\htdocs. Never commit the copied file or
 * the service-account JSON.
 *
 * Download it from Firebase Console > Project settings > Service accounts.
 * A service account can use Firestore on the Spark plan, but it has admin
 * access, so it must remain private to this local XAMPP machine.
 */
return [
    'projectId' => 'tick-c12a1',
    'serviceAccountPath' => 'C:/xampp/private/tick-c12a1-service-account.json',
];
