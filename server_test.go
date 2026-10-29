package main

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

type client struct {
	t   *testing.T
	url string
	c   *http.Client
}

func newTestServer(t *testing.T, signup bool) (*httptest.Server, string) {
	t.Helper()
	defaultIter = 1000 // keep the tests fast; real accounts use the full count
	dir := t.TempDir()
	s, err := newServer(config{Data: dir, Signup: signup, Secure: "never"})
	if err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(s.routes())
	t.Cleanup(ts.Close)
	return ts, dir
}

func newClient(t *testing.T, ts *httptest.Server) *client {
	j, _ := cookiejar.New(nil)
	return &client{t, ts.URL, &http.Client{Jar: j, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}}
}

func (c *client) do(method, path, body string, header bool) (int, string) {
	c.t.Helper()
	req, _ := http.NewRequest(method, c.url+path, strings.NewReader(body))
	if header {
		req.Header.Set("X-OpenSchem", "1")
	}
	req.Header.Set("Content-Type", "application/json")
	res, err := c.c.Do(req)
	if err != nil {
		c.t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res.StatusCode, string(b)
}

func (c *client) req(method, path string, body any) (int, map[string]any) {
	c.t.Helper()
	s := ""
	if body != nil {
		b, _ := json.Marshal(body)
		s = string(b)
	}
	code, out := c.do(method, path, s, true)
	var m map[string]any
	json.Unmarshal([]byte(out), &m)
	return code, m
}

func (c *client) signup(name string) string {
	c.t.Helper()
	code, m := c.req("POST", "/api/signup", map[string]string{"name": name, "password": "password123"})
	if code != 200 {
		c.t.Fatalf("signup %s: %d %v", name, code, m)
	}
	return m["id"].(string)
}

func expect(t *testing.T, got, want int, what string) {
	t.Helper()
	if got != want {
		t.Fatalf("%s: got %d, want %d", what, got, want)
	}
}

func TestPagesNeedSignIn(t *testing.T) {
	ts, _ := newTestServer(t, true)
	a := newClient(t, ts)
	code, _ := a.do("GET", "/", "", false)
	expect(t, code, 303, "app page while signed out")
	code, _ = a.do("GET", "/api/projects", "", false)
	expect(t, code, 401, "api while signed out")
	code, _ = a.do("GET", "/login", "", false)
	expect(t, code, 200, "sign-in page")
	a.signup("devon")
	code, body := a.do("GET", "/", "", false)
	expect(t, code, 200, "app page signed in")
	if !strings.Contains(body, `window.OS_SERVER={"user":{"id":`) || !strings.Contains(body, "function start()") {
		t.Fatal("app page is missing the server settings or the scripts")
	}
	code, _ = a.do("GET", "/login", "", false)
	expect(t, code, 303, "sign-in page while signed in")
}

func TestAccounts(t *testing.T) {
	ts, _ := newTestServer(t, true)
	a := newClient(t, ts)
	a.signup("devon")
	b := newClient(t, ts)
	code, _ := b.req("POST", "/api/signup", map[string]string{"name": "DEVON", "password": "password123"})
	expect(t, code, 409, "duplicate name, any case")
	code, _ = b.req("POST", "/api/signup", map[string]string{"name": "x", "password": "password123"})
	expect(t, code, 400, "short name")
	code, _ = b.req("POST", "/api/signup", map[string]string{"name": "alex", "password": "short"})
	expect(t, code, 400, "short password")
	code, _ = b.req("POST", "/api/login", map[string]string{"name": "devon", "password": "wrong-password"})
	expect(t, code, 401, "wrong password")
	code, _ = b.req("POST", "/api/login", map[string]string{"name": "Devon", "password": "password123"})
	expect(t, code, 200, "sign in, any case")
	code, _ = b.req("POST", "/api/logout", nil)
	expect(t, code, 200, "sign out")
	code, _ = b.req("GET", "/api/me", nil)
	expect(t, code, 401, "signed out after logout")

	// changing the password ends other sessions
	c := newClient(t, ts)
	c.req("POST", "/api/login", map[string]string{"name": "devon", "password": "password123"})
	code, _ = a.req("POST", "/api/password", map[string]string{"old": "nope-nope", "new": "newpassword1"})
	expect(t, code, 401, "change password with wrong current one")
	code, _ = a.req("POST", "/api/password", map[string]string{"old": "password123", "new": "newpassword1"})
	expect(t, code, 200, "change password")
	code, _ = a.req("GET", "/api/me", nil)
	expect(t, code, 200, "this session continues")
	code, _ = c.req("GET", "/api/me", nil)
	expect(t, code, 401, "other session ended")
	code, _ = c.req("POST", "/api/login", map[string]string{"name": "devon", "password": "newpassword1"})
	expect(t, code, 200, "new password works")
}

func TestLoginLimit(t *testing.T) {
	ts, _ := newTestServer(t, true)
	a := newClient(t, ts)
	a.signup("devon")
	b := newClient(t, ts)
	for i := 0; i < 5; i++ {
		b.req("POST", "/api/login", map[string]string{"name": "devon", "password": "wrong-password"})
	}
	code, _ := b.req("POST", "/api/login", map[string]string{"name": "devon", "password": "password123"})
	expect(t, code, 429, "locked after five failures")
}

func TestSignupOff(t *testing.T) {
	ts, _ := newTestServer(t, false)
	a := newClient(t, ts)
	code, _ := a.req("POST", "/api/signup", map[string]string{"name": "devon", "password": "password123"})
	expect(t, code, 403, "signup turned off")
	_, m := a.req("GET", "/api/config", nil)
	if m["signup"] != false {
		t.Fatal("config should report signup off")
	}
}

func TestRequestHeaderRequired(t *testing.T) {
	ts, _ := newTestServer(t, true)
	a := newClient(t, ts)
	code, _ := a.do("POST", "/api/signup", `{"name":"devon","password":"password123"}`, false)
	expect(t, code, 403, "POST without the request header")
}

func TestProjectsAndSharing(t *testing.T) {
	ts, dir := newTestServer(t, true)
	a, b, c := newClient(t, ts), newClient(t, ts), newClient(t, ts)
	a.signup("devon")
	bid := b.signup("alex")
	cid := c.signup("sam")

	code, p := a.req("POST", "/api/projects", map[string]any{"name": "House", "content": `{"pages":[]}`})
	expect(t, code, 200, "create")
	id := p["id"].(string)
	code, _ = a.req("POST", "/api/projects", map[string]any{"name": "Bad", "content": "not json"})
	expect(t, code, 400, "content must be JSON")

	code, _ = b.req("GET", "/api/projects/"+id, nil)
	expect(t, code, 404, "not shared yet")
	code, _ = b.req("PUT", "/api/projects/"+id+"/shares", map[string]any{"shares": map[string]string{bid: "edit"}})
	expect(t, code, 404, "cannot share someone else's project")

	code, p = a.req("PUT", "/api/projects/"+id+"/shares", map[string]any{"shares": map[string]string{bid: "view", cid: "edit", "nobody": "edit"}})
	expect(t, code, 200, "share")
	if sh := p["shares"].(map[string]any); len(sh) != 2 {
		t.Fatalf("unknown users must be dropped from shares: %v", sh)
	}

	code, p = b.req("GET", "/api/projects/"+id, nil)
	expect(t, code, 200, "viewer can open")
	if p["project"].(map[string]any)["access"] != "view" {
		t.Fatal("viewer access")
	}
	if _, ok := p["project"].(map[string]any)["shares"]; ok {
		t.Fatal("only the owner sees the share list")
	}
	code, _ = b.req("PUT", "/api/projects/"+id, map[string]any{"rev": 1, "content": "{}"})
	expect(t, code, 403, "viewer cannot save")
	code, _ = b.req("DELETE", "/api/projects/"+id, nil)
	expect(t, code, 403, "viewer cannot delete")
	code, _ = b.req("POST", "/api/projects/"+id+"/lock", nil)
	expect(t, code, 403, "viewer cannot lock")

	// edit lock: one editor at a time
	code, _ = a.req("POST", "/api/projects/"+id+"/lock", nil)
	expect(t, code, 200, "owner takes the lock")
	code, m := c.req("POST", "/api/projects/"+id+"/lock", nil)
	expect(t, code, 409, "editor waits for the lock")
	if m["project"].(map[string]any)["lockedBy"] != "devon" {
		t.Fatalf("lock holder name: %v", m)
	}
	code, m = c.req("PUT", "/api/projects/"+id, map[string]any{"rev": 1, "content": "{}"})
	expect(t, code, 409, "editor cannot save while locked")
	if m["error"] != "locked" {
		t.Fatal("expected a locked error")
	}
	code, p = a.req("PUT", "/api/projects/"+id, map[string]any{"name": "House v2", "rev": 1, "content": `{"v":2}`})
	expect(t, code, 200, "owner saves")
	if p["rev"].(float64) != 2 || p["name"] != "House v2" {
		t.Fatalf("revision and name after save: %v", p)
	}
	a.req("POST", "/api/projects/"+id+"/unlock", nil)
	code, _ = c.req("POST", "/api/projects/"+id+"/lock", nil)
	expect(t, code, 200, "editor gets the lock once released")

	// revision check
	code, m = c.req("PUT", "/api/projects/"+id, map[string]any{"rev": 1, "content": `{"v":3}`})
	expect(t, code, 409, "stale revision")
	if m["error"] != "conflict" || m["project"].(map[string]any)["updatedByName"] != "devon" {
		t.Fatalf("conflict details: %v", m)
	}
	code, _ = c.req("PUT", "/api/projects/"+id, map[string]any{"rev": 1, "force": true, "content": `{"v":3}`})
	expect(t, code, 200, "forced save")
	_, p = a.req("GET", "/api/projects/"+id, nil)
	if p["content"] != `{"v":3}` {
		t.Fatalf("content after forced save: %v", p["content"])
	}

	// lists
	var list []map[string]any
	_, body := b.do("GET", "/api/projects", "", false)
	json.Unmarshal([]byte(body), &list)
	if len(list) != 1 || list[0]["ownerName"] != "devon" {
		t.Fatalf("viewer list: %v", list)
	}
	_, body = b.do("GET", "/api/users", "", false)
	if !strings.Contains(body, `"name":"sam"`) || strings.Contains(body, "hash") || strings.Contains(body, "salt") {
		t.Fatalf("user list must hold names only: %s", body)
	}

	// only the owner deletes
	code, _ = a.req("DELETE", "/api/projects/"+id, nil)
	expect(t, code, 200, "owner deletes")
	if _, err := os.Stat(filepath.Join(dir, "projects", id+".osp")); !os.IsNotExist(err) {
		t.Fatal("project file should be gone")
	}
}

func TestDataFiles(t *testing.T) {
	ts, dir := newTestServer(t, true)
	a, b := newClient(t, ts), newClient(t, ts)
	aid := a.signup("devon")
	b.signup("alex")

	code, _ := a.req("PUT", "/api/data/prefs.json", map[string]string{"theme": "dark"})
	expect(t, code, 200, "write prefs")
	_, body := b.do("GET", "/api/data/prefs.json", "", false)
	if body != "" {
		t.Fatalf("prefs are per user, got %q", body)
	}
	a.req("PUT", "/api/data/parts.json", map[string]any{"parts": []string{"x"}})
	_, body = b.do("GET", "/api/data/parts.json", "", false)
	if !strings.Contains(body, `"x"`) {
		t.Fatal("parts are shared")
	}
	a.req("PUT", "/api/data/manufacturers.json", map[string]any{"manufacturers": []map[string]string{{"code": "DEV", "name": "Devon Controls"}}})
	_, body = b.do("GET", "/api/data/manufacturers.json", "", false)
	if !strings.Contains(body, `"DEV"`) {
		t.Fatal("the manufacturer list is shared")
	}
	for _, bad := range []string{"users.json", "sessions.json", "..%2Fusers.json", "autosave.json"} {
		code, _ := a.do("GET", "/api/data/"+bad, "", false)
		if code == 200 {
			t.Fatalf("%s must not be readable", bad)
		}
	}
	a.do("PUT", "/api/autosave", `{"project":1}`, true)
	_, body = a.do("GET", "/api/autosave", "", false)
	if body != `{"project":1}` {
		t.Fatalf("autosave: %q", body)
	}
	if _, err := os.Stat(filepath.Join(dir, "users", aid, "autosave.json")); err != nil {
		t.Fatal("autosave is stored per user")
	}
	a.do("PUT", "/api/autosave", "", true)
	_, body = a.do("GET", "/api/autosave", "", false)
	if body != "" {
		t.Fatal("empty autosave clears it")
	}
}

func TestSessionsSurviveRestart(t *testing.T) {
	defaultIter = 1000
	dir := t.TempDir()
	s1, _ := newServer(config{Data: dir, Signup: true, Secure: "never"})
	ts1 := httptest.NewServer(s1.routes())
	a := newClient(t, ts1)
	a.signup("devon")
	a.req("POST", "/api/projects", map[string]any{"name": "Kept", "content": "{}"})
	u, _ := http.NewRequest("GET", ts1.URL, nil)
	cookies := a.c.Jar.Cookies(u.URL)
	ts1.Close()

	s2, err := newServer(config{Data: dir, Signup: true, Secure: "never"})
	if err != nil {
		t.Fatal(err)
	}
	ts2 := httptest.NewServer(s2.routes())
	defer ts2.Close()
	b := newClient(t, ts2)
	u2, _ := http.NewRequest("GET", ts2.URL, nil)
	b.c.Jar.SetCookies(u2.URL, cookies)
	_, body := b.do("GET", "/api/projects", "", false)
	if !strings.Contains(body, `"name":"Kept"`) {
		t.Fatalf("after restart: %s", body)
	}
	raw, _ := os.ReadFile(filepath.Join(dir, "sessions.json"))
	if strings.Contains(string(raw), cookies[0].Value) {
		t.Fatal("sessions.json must not hold the raw token")
	}
}

func TestUserNameCannotBreakPage(t *testing.T) {
	ts, _ := newTestServer(t, true)
	a := newClient(t, ts)
	code, _ := a.req("POST", "/api/signup", map[string]string{"name": "a</script>", "password": "password123"})
	expect(t, code, 400, "names are limited to safe characters")
}
