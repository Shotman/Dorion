const { invoke } = window.__TAURI__

;(async () => {
  await displayLoadingTop()

  const config = JSON.parse(await invoke('read_config_file'))
  const plugins = await invoke('load_plugins');
  const version = await window.__TAURI__.app.getVersion()
  const midtitle = document.querySelector('#midtitle')
  const subtitle = document.querySelector('#subtitle')
  if (subtitle) subtitle.innerHTML = `Made with ❤️ by SpikeHD - v${version}</br></br>Press 'F' to enter settings`

  typingAnim()

  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'f') {
      // Interrupt the loading and put us in settings
      window.location.assign('/settings.html')
    }
  })
  
  if (midtitle) midtitle.innerHTML = "Localizing JS imports..."

  const imports = await invoke('localize_all_js', {
    urls: await invoke('get_plugin_import_urls', {
      pluginJs: plugins
    })
  })

  // Get theme if it exists
  let themeInjection = ''

  if (config.theme !== 'none') {
    if (midtitle) midtitle.innerHTML = "Loading theme CSS..."

    const themeContents = await invoke('get_theme', {
      name: config.theme
    })

    if (midtitle) midtitle.innerHTML = "Localizing CSS imports..."
    const localized = await invoke('localize_imports', {
      css: themeContents
    })

    // This will use the DOM in a funky way to validate the css, then we make sure to fix up quotes
    const cleanContents = cssSanitize(localized)?.replaceAll('\\"', '\'')

    // Write theme injection code
    themeInjection = `;(() => {
      const ts = document.createElement('style')

      ts.textContent = \`
        ${cleanContents?.replace(/`/g, '\\`')
            .replace(/\\8/g, '')
            .replace(/\\9/g, '')
          }
      \`

      document.head.appendChild(ts)
    })()`
  }

  if (midtitle) midtitle.innerHTML = "Getting injection JS..."

  const injectionJs = await invoke('get_injection_js', {
    pluginJs: plugins,
    themeJs: themeInjection,
    origin: window.location.origin
  })

  invoke('load_injection_js', {
    imports,
    contents: injectionJs
  })

  if (midtitle) midtitle.innerHTML = "Done!"

  // Remove loading container
  document.querySelector('#loadingContainer')?.remove()
})()

async function displayLoadingTop() {
  const html = await invoke('get_index')
  const loadingContainer = document.createElement('div')
  loadingContainer.id = 'loadingContainer'
  loadingContainer.innerHTML = html

  loadingContainer.style.zIndex = 99999
  loadingContainer.style.position = 'absolute'
  loadingContainer.style.top = '0'
  loadingContainer.style.left = '0'
  loadingContainer.style.width = '100vw'
  loadingContainer.style.height = '100vh'

  document.body.appendChild(loadingContainer)
}

document.addEventListener('dorionLoaded', () => {
  console.log("DORION LOADED")
  //invoke('settings_to_main')
})

async function typingAnim() {
  const title = document.querySelector('#title')

  if (!title) return

  for (const letter of title.split('')) {
    title.innerHTML = title.innerHTML.replace('|', '') + letter + '|'

    await timeout(100)
  }

  // Once the "typing" is done, blink the cursor
  let cur = true

  setInterval(() => {
    if (cur) {
      cur = false
      
      title.innerHTML = title.innerHTML.replace('|', '&nbsp;')
      return
    }
    
    cur = true
      
    title.innerHTML = title.innerHTML.replace(/&nbsp;$/, '|')
  }, 500)
}

async function timeout(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// Prevent any fuckery within themes
function cssSanitize(css) {
  const style = document.createElement('style');
  style.innerHTML = css;

  document.head.appendChild(style);

  if (!style.sheet) return

  const result = Array.from(style.sheet.cssRules).map(rule => rule.cssText || '').join('\n');

  document.head.removeChild(style);
  return result;
}