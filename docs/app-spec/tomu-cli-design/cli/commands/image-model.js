if (cmd === "image-model") {
  const googleProvider = await getEnabledGoogleProvider();
  if (!googleProvider) {
    console.error("No enabled Google provider found");
    process.exit(1);
  }
  const modelIds = await fetchGeminiImageModelIds(googleProvider);
  const best = pickBestImageModel(modelIds);
  if (!best) {
    console.error("No image generation model found");
    process.exit(1);
  }
  process.stdout.write(best);
  process.exit(0);
}
if (cmd === 'image-model') {
        const googleProvider = await getEnabledGoogleProvider();
        if (!googleProvider) {
            console.error('No enabled Google provider found');
            process.exit(1);
        }
        const modelIds = await fetchGeminiImageModelIds(googleProvider);
        const best = pickBestImageModel(modelIds);
        if (!best) {
            console.error('No image generation model found');
            process.exit(1);
        }
        process.stdout.write(best);
        process.exit(0);
    }

