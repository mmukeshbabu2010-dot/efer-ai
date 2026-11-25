import { useState, type FormEvent } from "react";
import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleHelp,
  Command,
  Image as ImageIcon,
  Menu,
  MessageSquare,
  Plus,
  Settings2,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";

type Workspace = "chat" | "images";

function App() {
  const [workspace, setWorkspace] = useState<Workspace>("chat");
  const [prompt, setPrompt] = useState("");
  const [notice, setNotice] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) return;

    setNotice(
      "Your message is ready, but no AI provider is connected yet. Open Settings to review the connection options.",
    );
  }

  function openWorkspace(next: Workspace) {
    setWorkspace(next);
    setNotice(
      next === "images"
        ? "Image Studio is planned for a later phase. The chat foundation comes first."
        : "",
    );
    setMobileMenuOpen(false);
  }

  return (
    <main className="app-shell">
      {mobileMenuOpen && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand-row">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div className="brand-copy">
            <span className="brand-name">EFER<span> AI</span></span>
            <span className="brand-caption">YOUR AI WORKSPACE</span>
          </div>
          <button
            className="icon-button mobile-close"
            aria-label="Close menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <button className="new-chat-button" onClick={() => openWorkspace("chat")}>
          <Plus size={17} />
          <span>New chat</span>
          <kbd>⌘ K</kbd>
        </button>

        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          <button
            className={`nav-item ${workspace === "chat" ? "nav-active" : ""}`}
            onClick={() => openWorkspace("chat")}
          >
            <MessageSquare size={17} />
            <span>Chat</span>
            {workspace === "chat" && <span className="active-dot" />}
          </button>
          <button
            className={`nav-item ${workspace === "images" ? "nav-active" : ""}`}
            onClick={() => openWorkspace("images")}
          >
            <ImageIcon size={17} />
            <span>Image Studio</span>
            <span className="soon-label">SOON</span>
          </button>
        </nav>

        <div className="sidebar-spacer" />

        <div className="privacy-note">
          <ShieldCheck size={17} />
          <div>
            <strong>Your workspace</strong>
            <span>Personal-first. Your choices matter.</span>
          </div>
        </div>

        <button className="settings-button" onClick={() => setSettingsOpen(true)}>
          <Settings2 size={18} />
          <span>Settings & connections</span>
        </button>

        <div className="sidebar-footer">
          <span className="status-indicator" />
          Foundation preview · v0.1.0
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={19} />
            </button>
            <div className="breadcrumb">
              <span>Workspace</span>
              <span className="breadcrumb-slash">/</span>
              <strong>{workspace === "chat" ? "Chat" : "Image Studio"}</strong>
            </div>
          </div>
          <div className="topbar-right">
            <div className="connection-pill">
              <span className="status-indicator status-muted" />
              No provider connected
            </div>
            <button
              className="topbar-settings"
              aria-label="Open settings"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings2 size={18} />
            </button>
          </div>
        </header>

        <div className="content-area">
          {workspace === "chat" ? (
            <div className="chat-home">
              <div className="welcome-badge"><Sparkles size={14} /> A NEW KIND OF AI WORKSPACE</div>
              <div className="welcome-icon"><Bot size={31} strokeWidth={1.5} /></div>
              <h1>One workspace.<br /><span>Many possibilities.</span></h1>
              <p className="welcome-description">
                Meet EFER AI — a flexible home for the AI models and tools you choose.
                Your workspace starts here.
              </p>

              <form className="composer" onSubmit={handleSubmit}>
                <label className="sr-only" htmlFor="prompt">Write your message</label>
                <textarea
                  id="prompt"
                  value={prompt}
                  onChange={(event) => {
                    setPrompt(event.target.value);
                    setNotice("");
                  }}
                  placeholder="Ask EFER AI anything..."
                  rows={2}
                />
                <div className="composer-bottom">
                  <div className="composer-hint">
                    <span className="composer-model"><Bot size={14} /> Provider not selected <ChevronDown size={13} /></span>
                    <span className="composer-shortcut">Enter to send</span>
                  </div>
                  <button className="send-button" type="submit" aria-label="Send message" disabled={!prompt.trim()}>
                    <ArrowUp size={18} />
                  </button>
                </div>
              </form>

              {notice && <div className="notice-message" role="status">{notice}</div>}

              <div className="suggestion-heading">WHAT WE'RE BUILDING</div>
              <div className="feature-grid">
                <div className="feature-card">
                  <div className="feature-icon purple"><MessageSquare size={17} /></div>
                  <strong>Unified chat</strong>
                  <span>Bring supported AI providers into one place.</span>
                </div>
                <div className="feature-card">
                  <div className="feature-icon blue"><Command size={17} /></div>
                  <strong>Your choice</strong>
                  <span>Choose your providers and connection method.</span>
                </div>
                <div className="feature-card">
                  <div className="feature-icon green"><ShieldCheck size={17} /></div>
                  <strong>Permission first</strong>
                  <span>Stay in control of where your data goes.</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="planned-view">
              <div className="welcome-icon"><ImageIcon size={29} /></div>
              <h1>Image Studio</h1>
              <p>This workspace is planned. We'll add image generation after the chat and provider foundations are working.</p>
              <button className="secondary-button" onClick={() => openWorkspace("chat")}>Back to chat</button>
            </div>
          )}
        </div>

        <footer className="main-footer">
          <span><CircleHelp size={14} /> EFER AI is under active development.</span>
          <span>Built for flexibility <span className="footer-star">✦</span></span>
        </footer>
      </section>

      {settingsOpen && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSettingsOpen(false);
        }}>
          <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-heading">
              <div>
                <span className="modal-eyebrow">PREFERENCES</span>
                <h2 id="settings-title">Settings & connections</h2>
              </div>
              <button className="icon-button" aria-label="Close settings" onClick={() => setSettingsOpen(false)}>
                <X size={19} />
              </button>
            </div>
            <div className="settings-status">
              <span className="status-indicator status-muted" />
              <div><strong>No AI providers connected</strong><span>Connection setup will be added in the next implementation phase.</span></div>
            </div>
            <h3>Connection methods</h3>
            <div className="connection-option">
              <div className="option-icon"><Command size={18} /></div>
              <div><strong>Use your own API key (BYOK)</strong><span>Connect a provider using your own account and key. Secure handling is required before enabling this.</span></div>
              <span className="option-state">PLANNED</span>
            </div>
            <div className="connection-option">
              <div className="option-icon"><Sparkles size={18} /></div>
              <div><strong>Built-in AI</strong><span>Use an EFER-managed backend connection when one is available.</span></div>
              <span className="option-state">PLANNED</span>
            </div>
            <div className="security-callout">
              <ShieldCheck size={17} />
              <p>Never paste an API key into this preview. We haven't implemented secure key storage or a backend proxy yet.</p>
            </div>
            <button className="secondary-button modal-done" onClick={() => setSettingsOpen(false)}>
              <Check size={16} /> Got it
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export default App;
