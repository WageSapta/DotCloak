# I Accidental Leaked My API Keys Live on Stream. Here’s How I Fixed It Forever with DotCloak 🛡️

_Stop sweating during Zoom calls and live streams. DotCloak brings stream-safe `.env` masking natively to VS Code._

---

![DotCloak Cover Concept](https://raw.githubusercontent.com/WageSapta/DotCloak/master/images/icon.png)

Picture this: You’re live on Twitch, YouTube, or screen sharing with 20 colleagues on Zoom. You need to debug a quick environment variable issue. You click on your `.env` file in VS Code—and **BAM!**

Your AWS secrets, Stripe private keys, and production database passwords are blast-blazed across everyone's screens in high definition. 😱

If your heart just skipped a beat reading that, you’re not alone. I’ve been there, my developer friends have been there, and honestly? It’s one of the most terrifying feelings in modern software engineering. One misclick, and suddenly you're spending the next two hours revoking tokens, regenerating credentials, and praying nobody recorded the stream.

That exact moment of panic is why I built **DotCloak**—a native VS Code extension designed specifically to make `.env` files stream-safe by default.

---

## What is DotCloak?

**DotCloak** is a VS Code extension that replaces the default plain-text editor for `.env` and `.env.*` files with a sleek, table-based custom editor where all secret values stay masked (`••••••••`) until you explicitly choose to reveal them.

Whether you're live streaming, recording video tutorials, or pair-programming with team members, DotCloak ensures your secrets stay secret.

---

## 🚀 Key Features That Make DotCloak Special

Here’s a breakdown of what happens under the hood when you install DotCloak:

### 1. 🙈 Masked by Default Table Editor

When you click any `.env`, `.env.local`, or `.env.production` file, DotCloak automatically opens a custom, searchable table editor. Every single value is masked out-of-the-box. No more accidental sneak-peeks!

### 2. 🔍 Client-Side Search & Sort

Managing 50+ environment variables in a massive `.env` file can be messy. DotCloak lets you search key names instantaneously and sort them alphabetically right inside the editor UI.

### 3. 🔓 Temporary 60-Second Reveal

Need to double-check a single API key while live? You don't have to unlock the whole file! DotCloak features a temporary reveal timer that automatically re-locks your credentials after 60 seconds.

### 4. 🛡️ Plain-Text Inline Masking (Decorator Mode)

Prefer reading your `.env` file as raw plain text? We’ve got you covered too! When opened in Plain Text mode, DotCloak uses VS Code editor decorations to inline-mask secret values with `***` overlays. The actual file remains clean, but anyone watching your screen only sees masked asterisks.

### 5. ⚠️ Type-to-Confirm Deletions

Accidentally deleting a critical production environment key is a nightmare. DotCloak requires you to type the key name to confirm deletion—saving you from accidental keystrokes.

### 6. 🔒 100% Local & Privacy First

Your environment variables never leave your computer. DotCloak runs entirely locally inside your VS Code client—no cloud syncs, no analytics, no external servers.

---

## ⚡ How to Get Started in 30 Seconds

Getting DotCloak running in your workflow is super straightforward:

1. **Install DotCloak**: Search for `DotCloak` in the VS Code Extensions Marketplace (`Ctrl+P` / `Cmd+P` -> type `ext install wagekusuma.dotcloak`).
2. **Open any `.env` file**: Simply click on any `.env` or `.env.*` file in your workspace Explorer.
3. **Enjoy Stream Peace of Mind**: DotCloak will automatically launch the masked table view!

Want to switch back to plain text mode for a moment? Click the **Exit Mode** button or right-click the file in Explorer and select **"Open as Plain Text"**. A helpful CodeLens prompt will always be right there to switch you back to DotCloak mode whenever you need it.

---

## 🛠️ Built for Developers, By a Developer

I built DotCloak because I wanted a tool that felt native, lightweight, and genuinely solved a problem every content creator and engineer faces daily.

If you find DotCloak helpful in your daily workflow, consider:

- ⭐ Giving the project a star on [GitHub](https://github.com/WageSapta/DotCloak)
- 📦 Leaving a review on the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=wagekusuma.dotcloak)
- ☕ Supporting the development on [Ko-fi](https://ko-fi.com/wagekusuma)

Happy coding, and may your API keys forever remain un-leaked! 🚀

---

### Useful Links:

- 📦 **VS Code Marketplace**: [Install DotCloak](https://marketplace.visualstudio.com/items?itemName=wagekusuma.dotcloak)
- 🐙 **GitHub Repository**: [WageSapta/DotCloak](https://github.com/WageSapta/DotCloak)
- ☕ **Support on Ko-fi**: [ko-fi.com/wagekusuma](https://ko-fi.com/wagekusuma)
