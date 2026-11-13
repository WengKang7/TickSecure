# Permanent event and category images

Images are uploaded by the authenticated PHP endpoint to Cloudinary. Firebase stores the HTTPS URL in Events.posterUrl or categories[categoryId].nftArtwork.imageUrl. Organizer uploads remain restricted to their own draft events. Image validation remains JPG/PNG, up to 5 MB. The shared artwork gallery remains bundled website assets.

## Account configuration

Create a free Cloudinary account. In Settings → API Keys, find the cloud name, API key, and API secret. Save them outside the web directory, in C:/xampp/private/cloudinary.env:

```
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

For Render add a Secret File named cloudinary.env with those contents, then save and deploy. The PHP worker already has the group required to read Render Secret Files. The Docker build excludes this secret from its image. A custom private path can be set through TICKSECURE_CLOUDINARY_ENV.

A local upload uses Cloudinary when the private configuration file exists. Render uploads always require Cloudinary and never save images to its temporary filesystem. Firebase Storage remains available for other supported deployments.

## Existing images

Run on the PC that holds the original uploaded images:

```
C:/xampp/php/php.exe scripts/migrate-cloudinary-images.php
C:/xampp/php/php.exe scripts/migrate-cloudinary-images.php --apply
```

The first command only reports counts. The second uploads local event posters and selected category artwork, then replaces matching image URLs in Firebase transactions. Published event status, ticket ownership, prices, seats and blockchain records are retained. Missing source files are reported and retained for later recovery. The script does not download arbitrary remote URLs. Repeated uploads reuse an event-specific content-hash asset without overwriting other images. Migration is CLI-only and excluded from the hosted Docker image.

Cloudinary configuration and actual uploads must be verified before migration or deployment is considered complete. Account quotas apply. Never commit the private configuration or paste its contents into chat.
