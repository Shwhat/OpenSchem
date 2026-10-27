//go:build windows

package main

import (
	"embed"
	"encoding/base64"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"syscall"
	"unicode/utf16"
	"unsafe"

	webview2 "github.com/jchv/go-webview2"
)

//go:embed ui/index.html ui/style.css ui/app.js ui/res.js ui/render.js ui/reports.js ui/floor.js ui/homedemo.js ui/ribbon.js ui/symedit.js ui/extra.js ui/todo.js ui/ui.js ui/vendor/jspdf.umd.min.js ui/vendor/svg2pdf.umd.min.js
var uiFS embed.FS

var (
	comdlg32         = syscall.NewLazyDLL("comdlg32.dll")
	user32           = syscall.NewLazyDLL("user32.dll")
	procGetOpenFile  = comdlg32.NewProc("GetOpenFileNameW")
	procGetSaveFile  = comdlg32.NewProc("GetSaveFileNameW")
	procMessageBox   = user32.NewProc("MessageBoxW")
	procSetWindowTxt = user32.NewProc("SetWindowTextW")
)

type openFileName struct {
	lStructSize       uint32
	hwndOwner         uintptr
	hInstance         uintptr
	lpstrFilter       *uint16
	lpstrCustomFilter *uint16
	nMaxCustFilter    uint32
	nFilterIndex      uint32
	lpstrFile         *uint16
	nMaxFile          uint32
	lpstrFileTitle    *uint16
	nMaxFileTitle     uint32
	lpstrInitialDir   *uint16
	lpstrTitle        *uint16
	flags             uint32
	nFileOffset       uint16
	nFileExtension    uint16
	lpstrDefExt       *uint16
	lCustData         uintptr
	lpfnHook          uintptr
	lpTemplateName    *uint16
	pvReserved        uintptr
	dwReserved        uint32
	flagsEx           uint32
}

const (
	ofnOverwritePrompt = 0x2
	ofnNoChangeDir     = 0x8
	ofnPathMustExist   = 0x800
	ofnFileMustExist   = 0x1000
	ofnExplorer        = 0x80000
)

var hwnd uintptr

func utf16z(s string) []uint16 { return append(utf16.Encode([]rune(s)), 0) }

func fileDialog(save bool, initial string) (string, bool) {
	return fileDialogF(save, initial, "OpenSchem project (*.osp)\x00*.osp\x00All files (*.*)\x00*.*\x00\x00", "osp")
}

func fileDialogF(save bool, initial, filterSpec, defExt string) (string, bool) {
	filter := utf16.Encode([]rune(filterSpec))
	buf := make([]uint16, 4096)
	copy(buf, utf16.Encode([]rune(initial)))
	ext := utf16z(defExt)
	ofn := openFileName{
		hwndOwner:   hwnd,
		lpstrFilter: &filter[0],
		nFilterIndex: 1,
		lpstrFile:   &buf[0],
		nMaxFile:    uint32(len(buf)),
		lpstrDefExt: &ext[0],
	}
	ofn.lStructSize = uint32(unsafe.Sizeof(ofn))
	var r uintptr
	if save {
		ofn.flags = ofnOverwritePrompt | ofnPathMustExist | ofnExplorer | ofnNoChangeDir
		r, _, _ = procGetSaveFile.Call(uintptr(unsafe.Pointer(&ofn)))
	} else {
		ofn.flags = ofnFileMustExist | ofnPathMustExist | ofnExplorer | ofnNoChangeDir
		r, _, _ = procGetOpenFile.Call(uintptr(unsafe.Pointer(&ofn)))
	}
	if r == 0 {
		return "", false
	}
	return syscall.UTF16ToString(buf), true
}

func messageBox(title, text string) {
	t, _ := syscall.UTF16PtrFromString(title)
	m, _ := syscall.UTF16PtrFromString(text)
	procMessageBox.Call(0, uintptr(unsafe.Pointer(m)), uintptr(unsafe.Pointer(t)), 0x10)
}

func writable(d string) bool {
	if os.MkdirAll(d, 0o755) != nil {
		return false
	}
	t := filepath.Join(d, ".write-test")
	if os.WriteFile(t, []byte("ok"), 0o644) != nil {
		return false
	}
	os.Remove(t)
	return true
}

// dataDir keeps everything next to the exe ("OpenSchem Data") so the program stays portable.
// If that folder is not writable (read-only media, Program Files), it falls back to %LOCALAPPDATA%.
func dataDir() string {
	if exe, err := os.Executable(); err == nil {
		d := filepath.Join(filepath.Dir(exe), "OpenSchem Data")
		if writable(d) {
			return d
		}
	}
	base := os.Getenv("LOCALAPPDATA")
	if base == "" {
		base = os.TempDir()
	}
	d := filepath.Join(base, "OpenSchem")
	os.MkdirAll(d, 0o755)
	return d
}

func writeAtomic(path string, content string) error {
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, []byte(content), 0o644); err != nil {
		return err
	}
	if _, err := os.Stat(path); err == nil {
		os.Remove(path + ".bak")
		os.Rename(path, path+".bak")
	}
	return os.Rename(tmp, path)
}

type fileResult struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

func assemble() string {
	read := func(n string) string { b, _ := uiFS.ReadFile("ui/" + n); return string(b) }
	html := read("index.html")
	js := read("vendor/jspdf.umd.min.js") + "\n" + read("vendor/svg2pdf.umd.min.js") + "\n"
	for _, n := range []string{"app.js", "res.js", "render.js", "reports.js", "floor.js", "homedemo.js", "ribbon.js", "symedit.js", "extra.js", "todo.js", "ui.js"} {
		js += read(n) + "\n"
	}
	html = strings.Replace(html, "/*CSS*/", read("style.css"), 1)
	js = strings.ReplaceAll(strings.ReplaceAll(js, "</script", "<\\/script"), "<script", "<\\x73cript")
	html = strings.Replace(html, "/*JS*/", js, 1)
	return html
}

func main() {
	runtime.LockOSThread()
	dir := dataDir()
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     os.Getenv("OPENSCHEM_DEBUG") == "1",
		AutoFocus: true,
		DataPath:  filepath.Join(dir, "WebView2"),
		WindowOptions: webview2.WindowOptions{
			Title:  "OpenSchem",
			Width:  1500,
			Height: 920,
			Center: true,
		},
	})
	if w == nil {
		messageBox("OpenSchem", "Microsoft Edge WebView2 Runtime was not found.\n\nIt is included with Windows 10 (21H2+) and Windows 11. Otherwise install the Evergreen runtime from Microsoft and start OpenSchem again.")
		return
	}
	defer w.Destroy()
	hwnd = uintptr(w.Window())

	autosavePath := filepath.Join(dir, "autosave.json")

	w.Bind("osOpen", func() (*fileResult, error) {
		p, ok := fileDialog(false, "")
		if !ok {
			return nil, nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		return &fileResult{Path: p, Content: string(b)}, nil
	})
	w.Bind("osSave", func(path, content string) (string, error) {
		return path, writeAtomic(path, content)
	})
	w.Bind("osSaveAs", func(content, name string) (string, error) {
		p, ok := fileDialog(true, name)
		if !ok {
			return "", nil
		}
		if !strings.Contains(filepath.Base(p), ".") {
			p += ".osp"
		}
		return p, writeAtomic(p, content)
	})
	w.Bind("osSaveText", func(content, name string) (string, error) {
		p, ok := fileDialogF(true, name, "CSV for Excel (*.csv)\x00*.csv\x00All files (*.*)\x00*.*\x00\x00", "csv")
		if !ok {
			return "", nil
		}
		return p, os.WriteFile(p, []byte(content), 0o644)
	})
	w.Bind("osSaveFile", func(content, name, desc, ext string) (string, error) {
		p, ok := fileDialogF(true, name, desc+" (*."+ext+")\x00*."+ext+"\x00All files (*.*)\x00*.*\x00\x00", ext)
		if !ok {
			return "", nil
		}
		return p, os.WriteFile(p, []byte(content), 0o644)
	})
	w.Bind("osSaveBase64", func(b64, name, desc, ext string) (string, error) {
		data, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return "", err
		}
		p, ok := fileDialogF(true, name, desc+" (*."+ext+")\x00*."+ext+"\x00All files (*.*)\x00*.*\x00\x00", ext)
		if !ok {
			return "", nil
		}
		return p, os.WriteFile(p, data, 0o644)
	})
	w.Bind("osOpenText", func(desc, ext string) (*fileResult, error) {
		p, ok := fileDialogF(false, "", desc+" (*."+ext+")\x00*."+ext+"\x00All files (*.*)\x00*.*\x00\x00", ext)
		if !ok {
			return nil, nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		return &fileResult{Path: p, Content: string(b)}, nil
	})
	dataFiles := map[string]bool{"prefs.json": true, "library.json": true}
	w.Bind("osReadData", func(name string) string {
		if !dataFiles[name] {
			return ""
		}
		b, err := os.ReadFile(filepath.Join(dir, name))
		if err != nil {
			return ""
		}
		return string(b)
	})
	w.Bind("osWriteData", func(name, content string) error {
		if !dataFiles[name] {
			return nil
		}
		return writeAtomic(filepath.Join(dir, name), content)
	})
	w.Bind("osDataDir", func() string { return dir })
	w.Bind("osSetTitle", func(t string) {
		p, _ := syscall.UTF16PtrFromString(t)
		procSetWindowTxt.Call(hwnd, uintptr(unsafe.Pointer(p)))
	})
	w.Bind("osAutosave", func(content string) error {
		if content == "" {
			os.Remove(autosavePath)
			return nil
		}
		return writeAtomic(autosavePath, content)
	})
	w.Bind("osGetAutosave", func() string {
		b, err := os.ReadFile(autosavePath)
		if err != nil {
			return ""
		}
		return string(b)
	})
	w.Bind("osInitialFile", func() (*fileResult, error) {
		if len(os.Args) < 2 {
			return nil, nil
		}
		b, err := os.ReadFile(os.Args[1])
		if err != nil {
			return nil, err
		}
		abs, _ := filepath.Abs(os.Args[1])
		return &fileResult{Path: abs, Content: string(b)}, nil
	})

	w.SetHtml(assemble())
	w.Run()
}
