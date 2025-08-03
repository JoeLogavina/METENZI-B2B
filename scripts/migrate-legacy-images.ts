#!/usr/bin/env tsx

/**
 * Script to migrate legacy product images to the new Enterprise Image Management System
 */
import { db } from '../server/db';
import { products } from '../shared/schema';
import { productImageService } from '../server/services/product-image.service';
import { isNull, not } from 'drizzle-orm';

async function migrateLegacyImages() {
  console.log('🚀 Starting legacy image migration...');
  
  try {
    // Get all products with legacy imageUrl that don't have new system images
    const productsWithLegacyImages = await db
      .select({
        id: products.id,
        name: products.name,
        imageUrl: products.imageUrl,
      })
      .from(products)
      .where(not(isNull(products.imageUrl)));

    console.log(`📊 Found ${productsWithLegacyImages.length} products with legacy images`);

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const product of productsWithLegacyImages) {
      console.log(`\n🔄 Processing: ${product.name} (${product.id})`);
      console.log(`📸 Legacy URL: ${product.imageUrl}`);

      try {
        const success = await productImageService.migrateLegacyImageToNewSystem(
          product.id,
          product.imageUrl || ''
        );

        if (success) {
          migratedCount++;
          console.log(`✅ Successfully migrated image for: ${product.name}`);
        } else {
          skippedCount++;
          console.log(`⏭️ Skipped (already has new system image): ${product.name}`);
        }
      } catch (error) {
        errorCount++;
        console.error(`❌ Error migrating ${product.name}:`, error);
      }
    }

    console.log('\n📋 Migration Summary:');
    console.log(`✅ Successfully migrated: ${migratedCount}`);
    console.log(`⏭️ Skipped (existing): ${skippedCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log(`📊 Total processed: ${productsWithLegacyImages.length}`);

    if (migratedCount > 0) {
      console.log('\n🎉 Legacy image migration completed successfully!');
      console.log('📌 Note: Legacy imageUrl fields are preserved for fallback compatibility');
    }

  } catch (error) {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  }
}

// Run the migration
migrateLegacyImages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });