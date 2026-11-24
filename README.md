# GAFC Personnel

Personnel management website for Global Armed Forces Command (GAFC). Members sign in with Discord. Rosters, counselings, and award recommendations run through role-based approval, and filed documents are saved to the GAFC Google Drive.

This repository holds only the website code. It contains no passwords, keys, or personnel data. The public Supabase key in config.js is designed to be public; row-level security in the database controls what each member can see.

Hosted with GitHub Pages. Backend: Supabase (database, sign-in, scheduled jobs, Discord bot function).
