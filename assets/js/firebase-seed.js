/**
 * Deliberately disabled browser seeder.
 *
 * Creating accounts or privileged records from a browser makes the generated
 * credentials and admin bootstrap path public. Seed Firestore with the Emulator
 * Suite or an Admin SDK script instead. This compatibility stub gives older
 * development notes a clear error instead of silently creating insecure data.
 */
export async function seedDatabase() {
    throw new Error(
        'Browser database seeding is disabled. Use the Firebase Emulator Suite or an Admin SDK seed script.'
    );
}

window.tsSeedDatabase = seedDatabase;
