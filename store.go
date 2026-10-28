package main

// Data volume layout (all paths under the data directory):
//
//	users.json             accounts
//	sessions.json          sign-in sessions (token hashes only)
//	projects.json          project list: owner, shares, revision, edit lock
//	projects/<id>.osp      project contents
//	users/<id>/prefs.json  per-user preferences
//	users/<id>/autosave.json
//	shared/library.json    symbol and macro library, shared by all users
//	shared/parts.json      parts database, shared
//	shared/blocks.json     block library, shared

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"
)

type User struct {
	ID      string    `json:"id"`
	Name    string    `json:"name"`
	Salt    string    `json:"salt"`
	Hash    string    `json:"hash"`
	Iter    int       `json:"iter"`
	Created time.Time `json:"created"`
}

type Session struct {
	User    string    `json:"user"`
	Expires time.Time `json:"expires"`
}

type Lock struct {
	User  string    `json:"user"`
	Until time.Time `json:"until"`
}

type Project struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Owner     string            `json:"owner"`
	Shares    map[string]string `json:"shares"` // user id -> "view" or "edit"
	Rev       int               `json:"rev"`
	Updated   time.Time         `json:"updated"`
	UpdatedBy string            `json:"updatedBy"`
	Lock      *Lock             `json:"lock,omitempty"`
}

// files the interface may read and write through /api/data; prefs are per user, the rest are shared
var dataFiles = map[string]bool{"prefs.json": false, "library.json": true, "parts.json": true, "blocks.json": true}

var (
	errNotFound  = errors.New("not found")
	errForbidden = errors.New("forbidden")
	errConflict  = errors.New("conflict")
	errLocked    = errors.New("locked")
)

type Store struct {
	dir      string
	mu       sync.Mutex
	users    []*User
	sessions map[string]*Session
	projects map[string]*Project
}

func newID() string {
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// writeAtomic writes through a temporary file and a rename so a crash never leaves half a file.
func writeAtomic(path string, data []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o750); err != nil {
		return err
	}
	tmp := path + ".tmp"
	f, err := os.OpenFile(tmp, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0o640)
	if err != nil {
		return err
	}
	if _, err = f.Write(data); err == nil {
		err = f.Sync()
	}
	if cerr := f.Close(); err == nil {
		err = cerr
	}
	if err != nil {
		os.Remove(tmp)
		return err
	}
	return os.Rename(tmp, path)
}

func readJSON(path string, v any) error {
	b, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	return json.Unmarshal(b, v)
}

func writeJSON(path string, v any) error {
	b, err := json.MarshalIndent(v, "", " ")
	if err != nil {
		return err
	}
	return writeAtomic(path, b)
}

func openStore(dir string) (*Store, error) {
	if err := os.MkdirAll(filepath.Join(dir, "projects"), 0o750); err != nil {
		return nil, err
	}
	s := &Store{dir: dir, sessions: map[string]*Session{}, projects: map[string]*Project{}}
	var u struct{ Users []*User }
	if err := readJSON(filepath.Join(dir, "users.json"), &u); err != nil {
		return nil, err
	}
	s.users = u.Users
	if err := readJSON(filepath.Join(dir, "sessions.json"), &s.sessions); err != nil {
		return nil, err
	}
	var ps []*Project
	if err := readJSON(filepath.Join(dir, "projects.json"), &ps); err != nil {
		return nil, err
	}
	for _, p := range ps {
		if p.Shares == nil {
			p.Shares = map[string]string{}
		}
		s.projects[p.ID] = p
	}
	if s.sessions == nil {
		s.sessions = map[string]*Session{}
	}
	return s, nil
}

func (s *Store) saveUsers() error {
	return writeJSON(filepath.Join(s.dir, "users.json"), struct {
		Users []*User `json:"users"`
	}{s.users})
}
func (s *Store) saveSessions() error {
	return writeJSON(filepath.Join(s.dir, "sessions.json"), s.sessions)
}
func (s *Store) saveProjects() error {
	ps := make([]*Project, 0, len(s.projects))
	for _, p := range s.projects {
		ps = append(ps, p)
	}
	sort.Slice(ps, func(i, j int) bool { return ps[i].ID < ps[j].ID })
	return writeJSON(filepath.Join(s.dir, "projects.json"), ps)
}

// ---------- users ----------

func (s *Store) userByName(name string) *User {
	for _, u := range s.users {
		if strings.EqualFold(u.Name, name) {
			return u
		}
	}
	return nil
}

func (s *Store) userByID(id string) *User {
	for _, u := range s.users {
		if u.ID == id {
			return u
		}
	}
	return nil
}

func (s *Store) userName(id string) string {
	if u := s.userByID(id); u != nil {
		return u.Name
	}
	return ""
}

func (s *Store) AddUser(name, password string) (*User, error) {
	salt, hash, iter := hashPassword(password) // slow; done before taking the lock
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.userByName(name) != nil {
		return nil, errConflict
	}
	u := &User{ID: newID(), Name: name, Salt: salt, Hash: hash, Iter: iter, Created: time.Now().UTC()}
	s.users = append(s.users, u)
	if err := s.saveUsers(); err != nil {
		s.users = s.users[:len(s.users)-1]
		return nil, err
	}
	return u, nil
}

// CheckPassword returns the user when name and password match.
func (s *Store) CheckPassword(name, password string) *User {
	s.mu.Lock()
	u := s.userByName(name)
	var cp User
	if u != nil {
		cp = *u
	}
	s.mu.Unlock()
	if u == nil {
		verifyPassword(password, dummySalt, dummyHash, defaultIter) // same cost as a real check
		return nil
	}
	if !verifyPassword(password, cp.Salt, cp.Hash, cp.Iter) {
		return nil
	}
	return u
}

func (s *Store) SetPassword(id, password string) error {
	salt, hash, iter := hashPassword(password)
	s.mu.Lock()
	defer s.mu.Unlock()
	u := s.userByID(id)
	if u == nil {
		return errNotFound
	}
	u.Salt, u.Hash, u.Iter = salt, hash, iter
	// end every other session of this user
	for k, v := range s.sessions {
		if v.User == id {
			delete(s.sessions, k)
		}
	}
	if err := s.saveSessions(); err != nil {
		return err
	}
	return s.saveUsers()
}

type UserInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

func (s *Store) Users() []UserInfo {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := make([]UserInfo, 0, len(s.users))
	for _, u := range s.users {
		out = append(out, UserInfo{u.ID, u.Name})
	}
	sort.Slice(out, func(i, j int) bool { return strings.ToLower(out[i].Name) < strings.ToLower(out[j].Name) })
	return out
}

// ---------- sessions ----------

const sessionLife = 30 * 24 * time.Hour

func (s *Store) NewSession(userID string) (string, error) {
	tok := newID() + newID()
	s.mu.Lock()
	defer s.mu.Unlock()
	now := time.Now()
	for k, v := range s.sessions {
		if now.After(v.Expires) {
			delete(s.sessions, k)
		}
	}
	s.sessions[tokenKey(tok)] = &Session{User: userID, Expires: now.Add(sessionLife).UTC()}
	return tok, s.saveSessions()
}

// Session returns the signed-in user for a token and extends the session when it is more than a day old.
func (s *Store) Session(tok string) *User {
	if tok == "" {
		return nil
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	k := tokenKey(tok)
	se := s.sessions[k]
	if se == nil {
		return nil
	}
	now := time.Now()
	if now.After(se.Expires) {
		delete(s.sessions, k)
		s.saveSessions()
		return nil
	}
	if se.Expires.Sub(now) < sessionLife-24*time.Hour {
		se.Expires = now.Add(sessionLife).UTC()
		s.saveSessions()
	}
	return s.userByID(se.User)
}

func (s *Store) EndSession(tok string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	delete(s.sessions, tokenKey(tok))
	s.saveSessions()
}

// ---------- projects ----------

func (p *Project) access(uid string) string {
	if p.Owner == uid {
		return "owner"
	}
	return p.Shares[uid]
}

func canEdit(a string) bool { return a == "owner" || a == "edit" }

type ProjectInfo struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Owner       string            `json:"owner"`
	OwnerName   string            `json:"ownerName"`
	Access      string            `json:"access"`
	Rev         int               `json:"rev"`
	Updated     time.Time         `json:"updated"`
	UpdatedBy   string            `json:"updatedByName"`
	Shares      map[string]string `json:"shares,omitempty"`
	LockedBy    string            `json:"lockedBy,omitempty"`
	LockedByYou bool              `json:"lockedByYou,omitempty"`
}

func (s *Store) info(p *Project, uid string) ProjectInfo {
	pi := ProjectInfo{ID: p.ID, Name: p.Name, Owner: p.Owner, OwnerName: s.userName(p.Owner), Access: p.access(uid), Rev: p.Rev, Updated: p.Updated, UpdatedBy: s.userName(p.UpdatedBy)}
	if pi.Access == "owner" {
		pi.Shares = p.Shares
	}
	if p.Lock != nil && time.Now().Before(p.Lock.Until) {
		if p.Lock.User == uid {
			pi.LockedByYou = true
		} else {
			pi.LockedBy = s.userName(p.Lock.User)
		}
	}
	return pi
}

func (s *Store) projectPath(id string) string { return filepath.Join(s.dir, "projects", id+".osp") }

func (s *Store) ListProjects(uid string) []ProjectInfo {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := []ProjectInfo{}
	for _, p := range s.projects {
		if p.access(uid) != "" {
			out = append(out, s.info(p, uid))
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Updated.After(out[j].Updated) })
	return out
}

func (s *Store) CreateProject(uid, name string, content []byte) (ProjectInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := &Project{ID: newID(), Name: name, Owner: uid, Shares: map[string]string{}, Rev: 1, Updated: time.Now().UTC(), UpdatedBy: uid}
	if err := writeAtomic(s.projectPath(p.ID), content); err != nil {
		return ProjectInfo{}, err
	}
	s.projects[p.ID] = p
	if err := s.saveProjects(); err != nil {
		return ProjectInfo{}, err
	}
	return s.info(p, uid), nil
}

func (s *Store) GetProject(uid, id string) (ProjectInfo, []byte, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.projects[id]
	if p == nil || p.access(uid) == "" {
		return ProjectInfo{}, nil, errNotFound
	}
	b, err := os.ReadFile(s.projectPath(id))
	if err != nil {
		return ProjectInfo{}, nil, err
	}
	return s.info(p, uid), b, nil
}

// SaveProject writes a new revision. rev is the revision the client started from; force skips that check.
func (s *Store) SaveProject(uid, id, name string, rev int, force bool, content []byte) (ProjectInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.projects[id]
	if p == nil || p.access(uid) == "" {
		return ProjectInfo{}, errNotFound
	}
	if !canEdit(p.access(uid)) {
		return s.info(p, uid), errForbidden
	}
	if p.Lock != nil && p.Lock.User != uid && time.Now().Before(p.Lock.Until) {
		return s.info(p, uid), errLocked
	}
	if !force && rev != p.Rev {
		return s.info(p, uid), errConflict
	}
	if err := writeAtomic(s.projectPath(id), content); err != nil {
		return ProjectInfo{}, err
	}
	p.Rev++
	if name != "" {
		p.Name = name
	}
	p.Updated, p.UpdatedBy = time.Now().UTC(), uid
	return s.info(p, uid), s.saveProjects()
}

func (s *Store) DeleteProject(uid, id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.projects[id]
	if p == nil || p.access(uid) == "" {
		return errNotFound
	}
	if p.Owner != uid {
		return errForbidden
	}
	delete(s.projects, id)
	os.Remove(s.projectPath(id))
	return s.saveProjects()
}

func (s *Store) SetShares(uid, id string, shares map[string]string) (ProjectInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.projects[id]
	if p == nil || p.access(uid) == "" {
		return ProjectInfo{}, errNotFound
	}
	if p.Owner != uid {
		return ProjectInfo{}, errForbidden
	}
	clean := map[string]string{}
	for k, v := range shares {
		if k == uid || s.userByID(k) == nil {
			continue
		}
		if v == "view" || v == "edit" {
			clean[k] = v
		}
	}
	p.Shares = clean
	return s.info(p, uid), s.saveProjects()
}

const lockLife = 2 * time.Minute

// TakeLock gives the user the edit lock if nobody else holds it. It returns the project info either way.
func (s *Store) TakeLock(uid, id string) (ProjectInfo, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	p := s.projects[id]
	if p == nil || p.access(uid) == "" {
		return ProjectInfo{}, errNotFound
	}
	if !canEdit(p.access(uid)) {
		return s.info(p, uid), errForbidden
	}
	now := time.Now()
	if p.Lock != nil && p.Lock.User != uid && now.Before(p.Lock.Until) {
		return s.info(p, uid), errLocked
	}
	p.Lock = &Lock{User: uid, Until: now.Add(lockLife).UTC()}
	return s.info(p, uid), nil // locks are short-lived and not written to disk
}

func (s *Store) ReleaseLock(uid, id string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p := s.projects[id]; p != nil && p.Lock != nil && p.Lock.User == uid {
		p.Lock = nil
	}
}

// ---------- data files and autosave ----------

func (s *Store) dataPath(uid, name string) (string, bool) {
	shared, ok := dataFiles[name]
	if !ok {
		return "", false
	}
	if shared {
		return filepath.Join(s.dir, "shared", name), true
	}
	return filepath.Join(s.dir, "users", uid, name), true
}

func (s *Store) ReadData(uid, name string) ([]byte, error) {
	p, ok := s.dataPath(uid, name)
	if !ok {
		return nil, errNotFound
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	b, err := os.ReadFile(p)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	return b, err
}

func (s *Store) WriteData(uid, name string, content []byte) error {
	p, ok := s.dataPath(uid, name)
	if !ok {
		return errNotFound
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return writeAtomic(p, content)
}

func (s *Store) autosavePath(uid string) string {
	return filepath.Join(s.dir, "users", uid, "autosave.json")
}

func (s *Store) ReadAutosave(uid string) []byte {
	s.mu.Lock()
	defer s.mu.Unlock()
	b, _ := os.ReadFile(s.autosavePath(uid))
	return b
}

func (s *Store) WriteAutosave(uid string, content []byte) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if len(content) == 0 {
		os.Remove(s.autosavePath(uid))
		return nil
	}
	return writeAtomic(s.autosavePath(uid), content)
}
