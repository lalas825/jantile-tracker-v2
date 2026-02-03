/** @type {import('tailwindcss').Config} */
module.exports = {
    // NOTE: Update this to include the paths to all of your component files.
    content: ["./src/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            fontFamily: {
                outfit: ["Outfit_400Regular", "Outfit_700Bold", "Outfit_900Black"],
                inter: ["Inter_400Regular", "Inter_700Bold", "Inter_900Black"],
            },
        },
    },
    plugins: [],
}
