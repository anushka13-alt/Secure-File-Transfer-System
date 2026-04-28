<?php
$file = fopen("riya.txt", "w");

if ($file) {
    echo "File opened successfully!";
    fclose($file);
} else {
    echo "Failed to open the file.";
}
?>