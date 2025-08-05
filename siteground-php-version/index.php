<?php
session_start();
require_once 'config/database.php';
require_once 'includes/auth.php';

// Check if user is logged in
if (!isLoggedIn()) {
    header('Location: login.php');
    exit;
}

$user = getCurrentUser();
$userRole = $user['role'];
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>B2B License Management Platform</title>
    <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet">
    <style>
        :root {
            --corporate-gray: #6E6F71;
            --spanish-yellow: #FFB20F;
        }
        .corporate-gray { background-color: var(--corporate-gray); }
        .spanish-yellow { background-color: var(--spanish-yellow); }
        .text-corporate-gray { color: var(--corporate-gray); }
        .text-spanish-yellow { color: var(--spanish-yellow); }
    </style>
</head>
<body class="bg-gray-100">
    <div class="flex h-screen">
        <!-- Sidebar -->
        <nav class="corporate-gray text-white w-64 p-6">
            <div class="mb-8">
                <h1 class="text-xl font-bold">B2B Platform</h1>
                <p class="text-sm opacity-75">Welcome, <?php echo htmlspecialchars($user['username']); ?></p>
            </div>
            
            <ul class="space-y-4">
                <?php if ($userRole === 'admin' || $userRole === 'super_admin'): ?>
                    <li><a href="admin/dashboard.php" class="block py-2 px-4 rounded hover:bg-gray-600">Admin Dashboard</a></li>
                    <li><a href="admin/products.php" class="block py-2 px-4 rounded hover:bg-gray-600">Manage Products</a></li>
                    <li><a href="admin/users.php" class="block py-2 px-4 rounded hover:bg-gray-600">Manage Users</a></li>
                    <li><a href="admin/orders.php" class="block py-2 px-4 rounded hover:bg-gray-600">Orders</a></li>
                <?php endif; ?>
                
                <?php if ($userRole === 'b2b_user' || $userRole === 'b2b_admin'): ?>
                    <li><a href="eur/shop.php" class="block py-2 px-4 rounded hover:bg-gray-600">EUR Shop</a></li>
                    <li><a href="km/shop.php" class="block py-2 px-4 rounded hover:bg-gray-600">KM Shop</a></li>
                    <li><a href="wallet.php" class="block py-2 px-4 rounded hover:bg-gray-600">Wallet</a></li>
                    <li><a href="orders.php" class="block py-2 px-4 rounded hover:bg-gray-600">My Orders</a></li>
                <?php endif; ?>
                
                <li><a href="profile.php" class="block py-2 px-4 rounded hover:bg-gray-600">Profile</a></li>
                <li><a href="logout.php" class="block py-2 px-4 rounded hover:bg-gray-600">Logout</a></li>
            </ul>
        </nav>

        <!-- Main Content -->
        <main class="flex-1 p-8">
            <div class="max-w-6xl mx-auto">
                <h2 class="text-3xl font-bold text-corporate-gray mb-8">Dashboard</h2>
                
                <?php if ($userRole === 'admin' || $userRole === 'super_admin'): ?>
                    <!-- Admin Dashboard -->
                    <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                        <div class="bg-white p-6 rounded-lg shadow">
                            <h3 class="text-lg font-semibold mb-2">Total Users</h3>
                            <p class="text-3xl font-bold text-spanish-yellow">
                                <?php echo getUserCount(); ?>
                            </p>
                        </div>
                        <div class="bg-white p-6 rounded-lg shadow">
                            <h3 class="text-lg font-semibold mb-2">Total Products</h3>
                            <p class="text-3xl font-bold text-spanish-yellow">
                                <?php echo getProductCount(); ?>
                            </p>
                        </div>
                        <div class="bg-white p-6 rounded-lg shadow">
                            <h3 class="text-lg font-semibold mb-2">Total Orders</h3>
                            <p class="text-3xl font-bold text-spanish-yellow">
                                <?php echo getOrderCount(); ?>
                            </p>
                        </div>
                    </div>
                    
                    <div class="bg-white p-6 rounded-lg shadow">
                        <h3 class="text-xl font-semibold mb-4">Recent Orders</h3>
                        <?php include 'includes/recent_orders.php'; ?>
                    </div>
                    
                <?php else: ?>
                    <!-- B2B User Dashboard -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                        <div class="bg-white p-6 rounded-lg shadow">
                            <h3 class="text-lg font-semibold mb-2">Wallet Balance</h3>
                            <p class="text-3xl font-bold text-spanish-yellow">
                                €<?php echo number_format(getWalletBalance($user['id']), 2); ?>
                            </p>
                        </div>
                        <div class="bg-white p-6 rounded-lg shadow">
                            <h3 class="text-lg font-semibold mb-2">Active Licenses</h3>
                            <p class="text-3xl font-bold text-spanish-yellow">
                                <?php echo getActiveLicenseCount($user['id']); ?>
                            </p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <a href="eur/shop.php" class="block bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                            <h3 class="text-xl font-semibold mb-2 text-corporate-gray">EUR Shop</h3>
                            <p class="text-gray-600">Browse and purchase software licenses in Euro</p>
                        </a>
                        <a href="km/shop.php" class="block bg-white p-6 rounded-lg shadow hover:shadow-lg transition-shadow">
                            <h3 class="text-xl font-semibold mb-2 text-corporate-gray">KM Shop</h3>
                            <p class="text-gray-600">Browse and purchase software licenses in KM currency</p>
                        </a>
                    </div>
                <?php endif; ?>
            </div>
        </main>
    </div>
</body>
</html>