// OpenSchem server: serves the interface in ui/ to the browser and stores accounts, projects,
// preferences and the shared libraries in a data folder. All drawing and editing logic lives in ui/.
package main

import (
	"embed"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"log"
	"net"
	"net/http"
	"os"
	"strings"
	"time"
)

//go:embed ui web
var assets embed.FS

const maxBody = 64 << 20 // projects with embedded images can be large

type config struct {
	Addr   string
	Data   string
	Signup bool
	Secure string // auto, always or never
}

func env(k, def string) string {
	if v := strings.TrimSpace(os.Getenv(k)); v != "" {
		return v
	}
	return def
}

func loadConfig() config {
	return config{
		Addr:   env("OPENSCHEM_ADDR", ":8080"),
		Data:   env("OPENSCHEM_DATA", "/data"),
		Signup: !strings.EqualFold(env("OPENSCHEM_SIGNUP", "on"), "off"),
		Secure: strings.ToLower(env("OPENSCHEM_SECURE_COOKIE", "auto")),
	}
}

// assemble builds the single page the browser loads: index.html with the stylesheet and
// every script listed in ui/manifest.txt inlined in order.
func assemble() string {
	read := func(n string) string { b, _ := assets.ReadFile("ui/" + n); return string(b) }
	var js strings.Builder
	for _, line := range strings.Split(read("manifest.txt"), "\n") {
		n := strings.TrimSpace(line)
		if n == "" || strings.HasPrefix(n, "#") {
			continue
		}
		js.WriteString(read(n))
		js.WriteString("\n")
	}
	code := strings.ReplaceAll(strings.ReplaceAll(js.String(), "</script", "<\\/script"), "<script", "<\\x73cript")
	page := strings.Replace(read("index.html"), "/*CSS*/", read("style.css"), 1)
	return strings.Replace(page, "/*JS*/", code, 1)
}

type server struct {
	cfg       config
	st        *Store
	appHead   string // the app page up to and including <head>
	appTail   string
	loginPage []byte
	loginLim  *limiter // failed sign-ins per user name
	ipLim     *limiter // failed sign-ins and new accounts per address
}

func newServer(cfg config) (*server, error) {
	st, err := openStore(cfg.Data)
	if err != nil {
		return nil, err
	}
	app := assemble()
	i := strings.Index(app, "<head>")
	if i < 0 {
		return nil, errors.New("ui/index.html has no <head>")
	}
	lp, err := assets.ReadFile("web/login.html")
	if err != nil {
		return nil, err
	}
	return &server{cfg: cfg, st: st, appHead: app[:i+6], appTail: app[i+6:], loginPage: lp,
		loginLim: newLimiter(5, 5*time.Minute), ipLim: newLimiter(30, 15*time.Minute)}, nil
}

func (s *server) routes() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("GET /healthz", func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("ok")) })
	m.HandleFunc("GET /login", s.loginHTML)
	m.HandleFunc("GET /{$}", s.appHTML)
	m.HandleFunc("GET /logo.png", func(w http.ResponseWriter, r *http.Request) {
		b, _ := assets.ReadFile("web/logo.png")
		w.Header().Set("Content-Type", "image/png")
		w.Write(b)
	})

	m.HandleFunc("GET /api/config", func(w http.ResponseWriter, r *http.Request) { sendJSON(w, map[string]bool{"signup": s.cfg.Signup}) })
	m.HandleFunc("POST /api/signup", s.signup)
	m.HandleFunc("POST /api/login", s.login)
	m.HandleFunc("POST /api/logout", s.logout)

	m.HandleFunc("GET /api/me", s.auth(func(w http.ResponseWriter, r *http.Request, u *User) { sendJSON(w, UserInfo{u.ID, u.Name}) }))
	m.HandleFunc("POST /api/password", s.auth(s.changePassword))
	m.HandleFunc("GET /api/users", s.auth(func(w http.ResponseWriter, r *http.Request, u *User) { sendJSON(w, s.st.Users()) }))

	m.HandleFunc("GET /api/projects", s.auth(func(w http.ResponseWriter, r *http.Request, u *User) { sendJSON(w, s.st.ListProjects(u.ID)) }))
	m.HandleFunc("POST /api/projects", s.auth(s.createProject))
	m.HandleFunc("GET /api/projects/{id}", s.auth(s.getProject))
	m.HandleFunc("PUT /api/projects/{id}", s.auth(s.saveProject))
	m.HandleFunc("DELETE /api/projects/{id}", s.auth(s.deleteProject))
	m.HandleFunc("PUT /api/projects/{id}/shares", s.auth(s.setShares))
	m.HandleFunc("POST /api/projects/{id}/lock", s.auth(s.lock))
	m.HandleFunc("POST /api/projects/{id}/unlock", s.auth(func(w http.ResponseWriter, r *http.Request, u *User) {
		s.st.ReleaseLock(u.ID, r.PathValue("id"))
		sendJSON(w, map[string]bool{"ok": true})
	}))

	m.HandleFunc("GET /api/data/{name}", s.auth(s.readData))
	m.HandleFunc("PUT /api/data/{name}", s.auth(s.writeData))
	m.HandleFunc("GET /api/autosave", s.auth(func(w http.ResponseWriter, r *http.Request, u *User) {
		w.Header().Set("Content-Type", "application/json")
		w.Write(s.st.ReadAutosave(u.ID))
	}))
	m.HandleFunc("PUT /api/autosave", s.auth(func(w http.ResponseWriter, r *http.Request, u *User) {
		b, ok := readBody(w, r)
		if !ok {
			return
		}
		if err := s.st.WriteAutosave(u.ID, b); err != nil {
			sendErr(w, 500, err.Error())
			return
		}
		sendJSON(w, map[string]bool{"ok": true})
	}))
	return securityHeaders(csrfGuard(m))
}

// ---------- helpers ----------

func securityHeaders(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("X-Frame-Options", "DENY")
		w.Header().Set("Referrer-Policy", "same-origin")
		h.ServeHTTP(w, r)
	})
}

// csrfGuard: every request that changes something must carry the X-OpenSchem header. Browsers do not let other
// sites add custom headers without a CORS preflight, which this server never allows.
func csrfGuard(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet && r.Method != http.MethodHead && r.Header.Get("X-OpenSchem") != "1" {
			sendErr(w, http.StatusForbidden, "missing request header")
			return
		}
		h.ServeHTTP(w, r)
	})
}

func sendJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	json.NewEncoder(w).Encode(v)
}

func sendErr(w http.ResponseWriter, code int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}

func readBody(w http.ResponseWriter, r *http.Request) ([]byte, bool) {
	b, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
	if err != nil {
		sendErr(w, http.StatusRequestEntityTooLarge, "request too large")
		return nil, false
	}
	return b, true
}

func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	b, ok := readBody(w, r)
	if !ok {
		return false
	}
	if err := json.Unmarshal(b, v); err != nil {
		sendErr(w, http.StatusBadRequest, "bad request")
		return false
	}
	return true
}

func clientIP(r *http.Request) string {
	h, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return h
}

const cookieName = "openschem_session"

func (s *server) secure(r *http.Request) bool {
	switch s.cfg.Secure {
	case "always":
		return true
	case "never":
		return false
	}
	return r.TLS != nil || strings.EqualFold(r.Header.Get("X-Forwarded-Proto"), "https")
}

func (s *server) setCookie(w http.ResponseWriter, r *http.Request, tok string, maxAge int) {
	http.SetCookie(w, &http.Cookie{Name: cookieName, Value: tok, Path: "/", MaxAge: maxAge, HttpOnly: true, Secure: s.secure(r), SameSite: http.SameSiteLaxMode})
}

func (s *server) user(r *http.Request) *User {
	c, err := r.Cookie(cookieName)
	if err != nil {
		return nil
	}
	return s.st.Session(c.Value)
}

func (s *server) auth(h func(http.ResponseWriter, *http.Request, *User)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		u := s.user(r)
		if u == nil {
			sendErr(w, http.StatusUnauthorized, "signed out")
			return
		}
		h(w, r, u)
	}
}

func storeErr(w http.ResponseWriter, err error, info *ProjectInfo) {
	switch {
	case errors.Is(err, errNotFound):
		sendErr(w, http.StatusNotFound, "not found")
	case errors.Is(err, errForbidden):
		sendErr(w, http.StatusForbidden, "you can only view this project")
	case errors.Is(err, errLocked), errors.Is(err, errConflict):
		code := "conflict"
		if errors.Is(err, errLocked) {
			code = "locked"
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		json.NewEncoder(w).Encode(map[string]any{"error": code, "project": info})
	default:
		log.Print(err)
		sendErr(w, http.StatusInternalServerError, "server error")
	}
}

// ---------- pages ----------

func (s *server) loginHTML(w http.ResponseWriter, r *http.Request) {
	if s.user(r) != nil {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(s.loginPage)
}

func (s *server) appHTML(w http.ResponseWriter, r *http.Request) {
	u := s.user(r)
	if u == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}
	cfg, _ := json.Marshal(map[string]any{"user": UserInfo{u.ID, u.Name}})
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	// the JSON is placed inside a script element, so "<" is escaped to keep a user name from closing it
	js := strings.ReplaceAll(string(cfg), "<", "\\u003c")
	fmt.Fprintf(w, "%s<script>window.OS_SERVER=%s;</script>%s", s.appHead, js, s.appTail)
}

// ---------- accounts ----------

type credentials struct {
	Name     string `json:"name"`
	Password string `json:"password"`
}

func (s *server) signup(w http.ResponseWriter, r *http.Request) {
	if !s.cfg.Signup {
		sendErr(w, http.StatusForbidden, "New accounts are turned off on this server.")
		return
	}
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	c.Name = strings.TrimSpace(c.Name)
	if !validName(c.Name) {
		sendErr(w, http.StatusBadRequest, "User names are 3 to 32 letters, digits, dots, dashes or underscores, starting with a letter or digit.")
		return
	}
	if !validPassword(c.Password) {
		sendErr(w, http.StatusBadRequest, "Passwords need at least 8 characters.")
		return
	}
	ip := clientIP(r)
	if s.ipLim.Blocked(ip) {
		sendErr(w, http.StatusTooManyRequests, "Too many attempts. Try again in a few minutes.")
		return
	}
	s.ipLim.Hit(ip)
	u, err := s.st.AddUser(c.Name, c.Password)
	if errors.Is(err, errConflict) {
		sendErr(w, http.StatusConflict, "That user name is taken.")
		return
	}
	if err != nil {
		storeErr(w, err, nil)
		return
	}
	s.startSession(w, r, u)
}

func (s *server) startSession(w http.ResponseWriter, r *http.Request, u *User) {
	tok, err := s.st.NewSession(u.ID)
	if err != nil {
		storeErr(w, err, nil)
		return
	}
	s.setCookie(w, r, tok, int(sessionLife.Seconds()))
	sendJSON(w, UserInfo{u.ID, u.Name})
}

func (s *server) login(w http.ResponseWriter, r *http.Request) {
	var c credentials
	if !decode(w, r, &c) {
		return
	}
	key := strings.ToLower(strings.TrimSpace(c.Name))
	ip := clientIP(r)
	if s.loginLim.Blocked(key) || s.ipLim.Blocked(ip) {
		sendErr(w, http.StatusTooManyRequests, "Too many attempts. Try again in a few minutes.")
		return
	}
	u := s.st.CheckPassword(strings.TrimSpace(c.Name), c.Password)
	if u == nil {
		s.loginLim.Hit(key)
		s.ipLim.Hit(ip)
		sendErr(w, http.StatusUnauthorized, "Wrong user name or password.")
		return
	}
	s.loginLim.Reset(key)
	s.startSession(w, r, u)
}

func (s *server) logout(w http.ResponseWriter, r *http.Request) {
	if c, err := r.Cookie(cookieName); err == nil {
		s.st.EndSession(c.Value)
	}
	s.setCookie(w, r, "", -1)
	sendJSON(w, map[string]bool{"ok": true})
}

func (s *server) changePassword(w http.ResponseWriter, r *http.Request, u *User) {
	var c struct {
		Old string `json:"old"`
		New string `json:"new"`
	}
	if !decode(w, r, &c) {
		return
	}
	if s.loginLim.Blocked(strings.ToLower(u.Name)) {
		sendErr(w, http.StatusTooManyRequests, "Too many attempts. Try again in a few minutes.")
		return
	}
	if s.st.CheckPassword(u.Name, c.Old) == nil {
		s.loginLim.Hit(strings.ToLower(u.Name))
		sendErr(w, http.StatusUnauthorized, "The current password is wrong.")
		return
	}
	if !validPassword(c.New) {
		sendErr(w, http.StatusBadRequest, "Passwords need at least 8 characters.")
		return
	}
	if err := s.st.SetPassword(u.ID, c.New); err != nil {
		storeErr(w, err, nil)
		return
	}
	s.startSession(w, r, u) // other sessions were ended; this one continues with a new token
}

// ---------- projects ----------

type projectBody struct {
	Name    string `json:"name"`
	Rev     int    `json:"rev"`
	Force   bool   `json:"force"`
	Content string `json:"content"`
}

func cleanName(n string) string {
	n = strings.TrimSpace(n)
	if n == "" {
		n = "Untitled"
	}
	if len(n) > 200 {
		n = n[:200]
	}
	return n
}

func (s *server) createProject(w http.ResponseWriter, r *http.Request, u *User) {
	var b projectBody
	if !decode(w, r, &b) {
		return
	}
	if !json.Valid([]byte(b.Content)) {
		sendErr(w, http.StatusBadRequest, "That is not an OpenSchem project.")
		return
	}
	info, err := s.st.CreateProject(u.ID, cleanName(b.Name), []byte(b.Content))
	if err != nil {
		storeErr(w, err, nil)
		return
	}
	sendJSON(w, info)
}

func (s *server) getProject(w http.ResponseWriter, r *http.Request, u *User) {
	info, content, err := s.st.GetProject(u.ID, r.PathValue("id"))
	if err != nil {
		storeErr(w, err, nil)
		return
	}
	sendJSON(w, map[string]any{"project": info, "content": string(content)})
}

func (s *server) saveProject(w http.ResponseWriter, r *http.Request, u *User) {
	var b projectBody
	if !decode(w, r, &b) {
		return
	}
	if !json.Valid([]byte(b.Content)) {
		sendErr(w, http.StatusBadRequest, "That is not an OpenSchem project.")
		return
	}
	name := ""
	if strings.TrimSpace(b.Name) != "" {
		name = cleanName(b.Name)
	}
	info, err := s.st.SaveProject(u.ID, r.PathValue("id"), name, b.Rev, b.Force, []byte(b.Content))
	if err != nil {
		storeErr(w, err, &info)
		return
	}
	sendJSON(w, info)
}

func (s *server) deleteProject(w http.ResponseWriter, r *http.Request, u *User) {
	if err := s.st.DeleteProject(u.ID, r.PathValue("id")); err != nil {
		if errors.Is(err, errForbidden) {
			sendErr(w, http.StatusForbidden, "Only the owner can delete a project.")
			return
		}
		storeErr(w, err, nil)
		return
	}
	sendJSON(w, map[string]bool{"ok": true})
}

func (s *server) setShares(w http.ResponseWriter, r *http.Request, u *User) {
	var b struct {
		Shares map[string]string `json:"shares"`
	}
	if !decode(w, r, &b) {
		return
	}
	info, err := s.st.SetShares(u.ID, r.PathValue("id"), b.Shares)
	if err != nil {
		if errors.Is(err, errForbidden) {
			sendErr(w, http.StatusForbidden, "Only the owner can share a project.")
			return
		}
		storeErr(w, err, nil)
		return
	}
	sendJSON(w, info)
}

func (s *server) lock(w http.ResponseWriter, r *http.Request, u *User) {
	info, err := s.st.TakeLock(u.ID, r.PathValue("id"))
	if err != nil {
		storeErr(w, err, &info)
		return
	}
	sendJSON(w, info)
}

// ---------- data files ----------

func (s *server) readData(w http.ResponseWriter, r *http.Request, u *User) {
	b, err := s.st.ReadData(u.ID, r.PathValue("name"))
	if err != nil {
		storeErr(w, err, nil)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.Write(b)
}

func (s *server) writeData(w http.ResponseWriter, r *http.Request, u *User) {
	b, ok := readBody(w, r)
	if !ok {
		return
	}
	if err := s.st.WriteData(u.ID, r.PathValue("name"), b); err != nil {
		storeErr(w, err, nil)
		return
	}
	sendJSON(w, map[string]bool{"ok": true})
}

// ---------- main ----------

func healthcheck(addr string) int {
	if strings.HasPrefix(addr, ":") {
		addr = "127.0.0.1" + addr
	}
	c := http.Client{Timeout: 3 * time.Second}
	res, err := c.Get("http://" + addr + "/healthz")
	if err != nil || res.StatusCode != 200 {
		return 1
	}
	return 0
}

func main() {
	hc := flag.Bool("healthcheck", false, "check that the server answers and exit")
	flag.Parse()
	cfg := loadConfig()
	if *hc {
		os.Exit(healthcheck(cfg.Addr))
	}
	s, err := newServer(cfg)
	if err != nil {
		log.Fatalf("OpenSchem: %v", err)
	}
	srv := &http.Server{Addr: cfg.Addr, Handler: s.routes(), ReadHeaderTimeout: 10 * time.Second, IdleTimeout: 120 * time.Second}
	log.Printf("OpenSchem %s listening on %s, data in %s, new accounts %s", version(), cfg.Addr, cfg.Data, map[bool]string{true: "on", false: "off"}[cfg.Signup])
	log.Fatal(srv.ListenAndServe())
}

func version() string {
	b, _ := assets.ReadFile("ui/js/migrate.js")
	s := string(b)
	if i := strings.Index(s, "APP_VERSION = '"); i >= 0 {
		s = s[i+15:]
		if j := strings.Index(s, "'"); j >= 0 {
			return s[:j]
		}
	}
	return "?"
}
