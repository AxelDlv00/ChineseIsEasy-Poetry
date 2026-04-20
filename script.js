document.addEventListener('DOMContentLoaded', async () => {
    const poemList = document.getElementById('poem-list');
    const poemContainer = document.getElementById('poem-container');
    const welcomeMessage = document.getElementById('welcome-message');
    const tooltip = document.getElementById('tooltip');
    
    const sidebar = document.getElementById('sidebar');
    const openBtn = document.getElementById('open-sidebar');
    const closeBtn = document.getElementById('close-sidebar');

    openBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.add('mobile-open');
        } else {
            sidebar.classList.remove('collapsed');
        }
    });

    closeBtn.addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('mobile-open');
        } else {
            sidebar.classList.add('collapsed');
        }
    });

    document.querySelector('.content').addEventListener('click', (e) => {
        if (window.innerWidth <= 768 && e.target !== openBtn) {
            sidebar.classList.remove('mobile-open');
        }
    });

    async function initCatalog() {
        try {
            const response = await fetch('poems.json');
            if (!response.ok) throw new Error("Impossible de charger poems.json");
            const poems = await response.json();
            
            poemList.innerHTML = '';
            
            poems.forEach((poem, index) => {
                const li = document.createElement('li');
                li.textContent = poem.title;
                li.setAttribute('data-file', poem.path);
                
                if (index === 0) {
                    li.classList.add('active');
                    loadPoem(poem.path);
                }
                
                poemList.appendChild(li);
            });
        } catch (error) {
            console.error(error);
            poemList.innerHTML = '<li style="color:red">Erreur : Catalogue introuvable</li>';
        }
    }

    poemList.addEventListener('click', async (e) => {
        const li = e.target.closest('li');
        if (!li) return;

        document.querySelectorAll('#poem-list li').forEach(el => el.classList.remove('active'));
        li.classList.add('active');
        
        if (window.innerWidth <= 768) {
            sidebar.classList.remove('mobile-open');
        }

        const filepath = li.getAttribute('data-file'); 
        await loadPoem(filepath); 
    });

    async function loadPoem(filepath) {
        try {
            const response = await fetch(filepath);
            if (!response.ok) throw new Error(`Fichier introuvable : ${filepath}`);
            let markdown = await response.text();
            
            const folder = filepath.substring(0, filepath.lastIndexOf('/'));
            
            markdown = markdown.replace(/src=["']([^http].*?)["']/g, (match, srcPath) => {
                return `src="${folder}/${encodeURI(srcPath)}"`;
            });
            
            configureMarked(folder);
            parseAndRender(markdown);
            
            welcomeMessage.classList.add('hidden');
            poemContainer.classList.remove('hidden');
        } catch (error) {
            console.error(error);
            poemContainer.innerHTML = `<div style="color:red; padding: 20px;">Erreur : Impossible de charger le fichier <b>${filepath}</b>.</div>`;
        }
    }

    function parseAndRender(markdown) {
        const sections = markdown.split('\n## ');
        const headerText = sections[0];
        
        let poemText = "";
        let vocabDict = {};
        let remainingMarkdown = "";

        for (let i = 1; i < sections.length; i++) {
            const section = sections[i];
            if (section.startsWith('Poème')) {
                poemText = section.replace('Poème', '').trim();
            } else if (section.startsWith('Vocabulaire')) {
                vocabDict = parseVocabTable(section);
            } else {
                remainingMarkdown += '## ' + section + '\n';
            }
        }

        document.getElementById('md-header').innerHTML = marked.parse(headerText);
        document.getElementById('md-content').innerHTML = marked.parse(remainingMarkdown);
        
        renderCalligraphyPoem(poemText, vocabDict);
    }

    function parseVocabTable(vocabSection) {
        const dict = {};
        const lines = vocabSection.split('\n');
        
        for (const line of lines) {
            if (!line.includes('|') || line.includes('---') || line.includes('Caractère')) continue;
            
            const cols = line.split('|').map(c => c.trim());
            if (cols.length >= 5) {
                const char = cols[1].replace(/[*]/g, '');
                const pinyin = cols[2].replace(/[*_]/g, '');
                const meaning = cols[3];
                const note = cols[4];
                dict[char] = { pinyin, meaning, note };
            }
        }
        return dict;
    }

    function configureMarked(folder) {
        const renderer = new marked.Renderer();
        renderer.image = function(href, title, text) {
            const newHref = href.startsWith('http') ? href : `${folder}/${encodeURI(href)}`;
            return `<div class="image-container" style="text-align:center;">
                        <img src="${newHref}" alt="${text}" style="max-width:100%; border-radius:10px;">
                        ${text ? `<p><em>${text}</em></p>` : ''}
                    </div>`;
        };
        marked.setOptions({ renderer: renderer });
    }

    function renderCalligraphyPoem(text, dictionary) {
        const container = document.getElementById('calligraphy-poem');
        container.innerHTML = '';
        
        const verses = text.split(/\n\s*\n|\n/).filter(l => l.trim() !== '');

        verses.forEach(line => {
            const row = document.createElement('div');
            row.className = 'poem-verse';

            const chars = Array.from(line.trim());
            let i = 0;

            while (i < chars.length) {
                let matchFound = false;

                // Search for the longest possible word (max 4 characters)
                for (let len = 4; len >= 1; len--) {
                    if (i + len > chars.length) continue;
                    
                    const word = chars.slice(i, i + len).join('');
                    const info = dictionary[word];

                    if (info) {
                        matchFound = true;
                        
                        const wordSpan = document.createElement('span');
                        wordSpan.className = 'poem-word';
                        wordSpan.textContent = word;
                        
                        setupTooltip(wordSpan, info);
                        row.appendChild(wordSpan);
                        
                        i += len; 
                        break;
                    }
                }

                // If no word is found (e.g., punctuation or unknown character)
                if (!matchFound) {
                    const char = chars[i];
                    
                    // Treat it as normal text, no special punctuation class
                    const charSpan = document.createElement('span');
                    charSpan.textContent = char;
                    row.appendChild(charSpan);
                    
                    i++;
                }
            }
            container.appendChild(row);
        });
    }

    function setupTooltip(element, data) {
        element.addEventListener('mouseenter', () => {
            tooltip.innerHTML = `
                <div class="pinyin">${data.pinyin}</div>
                <div class="meaning">${data.meaning}</div>
                ${data.note ? `<div class="note">${data.note}</div>` : ''}
            `;
            
            // Calculer les dimensions
            const rect = element.getBoundingClientRect();
            const tooltipRect = tooltip.getBoundingClientRect();
            
            // Position de base (centrée au dessus du mot)
            let leftPos = rect.left + (rect.width / 2) + window.scrollX;
            let topPos = rect.top + window.scrollY - 10;
            
            // Ajustement mobile (éviter de sortir de l'écran horizontalement)
            const margin = 10;
            const minLeft = margin + window.scrollX;
            const maxRight = window.innerWidth - margin + window.scrollX;
            
            let tooltipLeftEdge = leftPos - (tooltipRect.width / 2);
            let tooltipRightEdge = leftPos + (tooltipRect.width / 2);
            
            if (tooltipLeftEdge < minLeft) {
                leftPos = minLeft + (tooltipRect.width / 2);
            } else if (tooltipRightEdge > maxRight) {
                leftPos = maxRight - (tooltipRect.width / 2);
            }

            tooltip.style.left = leftPos + 'px';
            tooltip.style.top = topPos + 'px';
            tooltip.classList.add('show');
        });

        element.addEventListener('mouseleave', () => {
            tooltip.classList.remove('show');
        });
    }

    initCatalog();
});