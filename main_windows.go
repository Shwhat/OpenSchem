//go:build windows

// OpenSchem Windows host: a WebView2 window running the interface in ui/,
// plus the small set of operating-system services the interface calls (file dialogs,
// the portable data folder, autosave). All drawing and editing logic lives in ui/.
package main

import (
	"embed"
	"encoding/base64"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	webview2 "github.com/jchv/go-webview2"
)

//go:embed ui
var uiFS embed.FS

type fileResult struct {
	Path    string `json:"path"`
	Content string `json:"content"`
}

// assemble builds the single page the window loads: index.html with the stylesheet and
// every script listed in ui/manifest.txt inlined in order.
func assemble() string {
	read := func(n string) string { b, _ := uiFS.ReadFile("ui/" + n); return string(b) }
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
	html := strings.Replace(read("index.html"), "/*CSS*/", read("style.css"), 1)
	return strings.Replace(html, "/*JS*/", code, 1)
}

func main() {
	runtime.LockOSThread()
	dir := dataDir()
	w := webview2.NewWithOptions(webview2.WebViewOptions{
		Debug:     os.Getenv("OPENSCHEM_DEBUG") == "1",
		AutoFocus: true,
		DataPath:  filepath.Join(dir, "WebView2"),
		WindowOptions: webview2.WindowOptions{Title: "OpenSchem", Width: 1500, Height: 920, Center: true},
	})
	if w == nil {
		messageBox(0, "OpenSchem", "Microsoft Edge WebView2 Runtime was not found.\n\nIt is included with Windows 10 (21H2+) and Windows 11. Otherwise install the Evergreen runtime from Microsoft and start OpenSchem again.", mbIconError)
		return
	}
	defer w.Destroy()
	mainHwnd = uintptr(w.Window())
	autosavePath := filepath.Join(dir, "autosave.json")

	onCloseSave = func() { w.Eval("closeAfterSave()") }
	onDiscard = func() { os.Remove(autosavePath) }
	hookClose()

	saveDialog := func(name, desc, ext string, data []byte) (string, error) {
		p, ok := fileDialog(true, name, filterSpec(desc, ext), ext)
		if !ok {
			return "", nil
		}
		return p, os.WriteFile(p, data, 0o644)
	}
	openDialog := func(desc, ext string) (*fileResult, error) {
		p, ok := fileDialog(false, "", filterSpec(desc, ext), ext)
		if !ok {
			return nil, nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		return &fileResult{Path: p, Content: string(b)}, nil
	}

	// projects
	w.Bind("osOpen", func() (*fileResult, error) { return openDialog("OpenSchem project", "osp") })
	w.Bind("osSave", func(path, content string) (string, error) { return path, writeAtomic(path, []byte(content)) })
	w.Bind("osSaveAs", func(content, name string) (string, error) {
		p, ok := fileDialog(true, name, filterSpec("OpenSchem project", "osp"), "osp")
		if !ok {
			return "", nil
		}
		if filepath.Ext(p) == "" {
			p += ".osp"
		}
		return p, writeAtomic(p, []byte(content))
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

	// exports and imports
	w.Bind("osSaveText", func(content, name string) (string, error) { return saveDialog(name, "CSV for Excel", "csv", []byte(content)) })
	w.Bind("osSaveFile", func(content, name, desc, ext string) (string, error) { return saveDialog(name, desc, ext, []byte(content)) })
	w.Bind("osSaveBase64", func(b64, name, desc, ext string) (string, error) {
		data, err := base64.StdEncoding.DecodeString(b64)
		if err != nil {
			return "", err
		}
		return saveDialog(name, desc, ext, data)
	})
	w.Bind("osOpenText", func(desc, ext string) (*fileResult, error) { return openDialog(desc, ext) })
	w.Bind("osOpenBase64", func(desc, ext string) (*fileResult, error) {
		p, ok := fileDialog(false, "", filterSpec(desc, ext), ext)
		if !ok {
			return nil, nil
		}
		b, err := os.ReadFile(p)
		if err != nil {
			return nil, err
		}
		return &fileResult{Path: p, Content: base64.StdEncoding.EncodeToString(b)}, nil
	})

	// portable data folder (preferences, symbol/macro/parts library)
	dataFiles := map[string]bool{"prefs.json": true, "library.json": true, "parts.json": true, "blocks.json": true}
	w.Bind("osReadData", func(name string) string {
		if !dataFiles[name] {
			return ""
		}
		b, _ := os.ReadFile(filepath.Join(dir, name))
		return string(b)
	})
	w.Bind("osWriteData", func(name, content string) error {
		if !dataFiles[name] {
			return nil
		}
		return writeAtomic(filepath.Join(dir, name), []byte(content))
	})
	w.Bind("osDataDir", func() string { return dir })
	w.Bind("osAutosave", func(content string) error {
		if content == "" {
			os.Remove(autosavePath)
			return nil
		}
		return writeAtomic(autosavePath, []byte(content))
	})
	w.Bind("osGetAutosave", func() string { b, _ := os.ReadFile(autosavePath); return string(b) })

	// window
	w.Bind("osSetTitle", func(t string) { setWindowTitle(t) })
	w.Bind("osSetDirty", func(d bool) { unsaved = d })
	w.Bind("osQuit", func() { quitApp() })

	w.SetHtml(assemble())
	w.Run()
}
