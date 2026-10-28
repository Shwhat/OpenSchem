package main

import (
	"crypto/pbkdf2"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/hex"
	"regexp"
	"sync"
	"time"
)

// PBKDF2-HMAC-SHA256 with the iteration count recommended by OWASP. The count is stored per user so it can be raised later.
var defaultIter = 600000

var (
	dummySalt = hex.EncodeToString(make([]byte, 16))
	dummyHash = hex.EncodeToString(make([]byte, 32))
)

func derive(password string, salt []byte, iter int) []byte {
	k, err := pbkdf2.Key(sha256.New, password, salt, iter, 32)
	if err != nil {
		panic(err)
	}
	return k
}

func hashPassword(password string) (salt, hash string, iter int) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b), hex.EncodeToString(derive(password, b, defaultIter)), defaultIter
}

func verifyPassword(password, salt, hash string, iter int) bool {
	sb, err1 := hex.DecodeString(salt)
	hb, err2 := hex.DecodeString(hash)
	if err1 != nil || err2 != nil || iter <= 0 {
		return false
	}
	return subtle.ConstantTimeCompare(derive(password, sb, iter), hb) == 1
}

// tokenKey is what sessions.json stores, so a copy of the data folder does not hold usable session tokens.
func tokenKey(tok string) string {
	h := sha256.Sum256([]byte(tok))
	return hex.EncodeToString(h[:])
}

var nameRe = regexp.MustCompile(`^[A-Za-z0-9][A-Za-z0-9._-]{2,31}$`)

func validName(n string) bool { return nameRe.MatchString(n) }

func validPassword(p string) bool { return len(p) >= 8 && len(p) <= 200 }

// limiter slows down password guessing: after 5 failures for a key, further tries wait until the window passes.
type limiter struct {
	mu     sync.Mutex
	hits   map[string][]time.Time
	max    int
	window time.Duration
}

func newLimiter(max int, window time.Duration) *limiter {
	return &limiter{hits: map[string][]time.Time{}, max: max, window: window}
}

func (l *limiter) prune(k string, now time.Time) []time.Time {
	h := l.hits[k]
	i := 0
	for i < len(h) && now.Sub(h[i]) > l.window {
		i++
	}
	h = h[i:]
	if len(h) == 0 {
		delete(l.hits, k)
	} else {
		l.hits[k] = h
	}
	return h
}

func (l *limiter) Blocked(k string) bool {
	l.mu.Lock()
	defer l.mu.Unlock()
	return len(l.prune(k, time.Now())) >= l.max
}

func (l *limiter) Hit(k string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	now := time.Now()
	l.hits[k] = append(l.prune(k, now), now)
}

func (l *limiter) Reset(k string) {
	l.mu.Lock()
	defer l.mu.Unlock()
	delete(l.hits, k)
}
