import { TicketMessage } from '@prisma/client';

export class TranscriptGenerator {

    static generateHTML(messages: TicketMessage[], ticketId: string, guildName: string): string {
        const rows = messages.map(msg => this.renderMessage(msg)).join('\n');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transcript - ${ticketId}</title>
    <style>
        body {
            background-color: #313338;
            color: #dbdee1;
            font-family: 'gg sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
            font-size: 16px;
            margin: 0;
            padding: 20px;
        }
        .header {
            padding-bottom: 20px;
            border-bottom: 1px solid #2b2d31;
            margin-bottom: 20px;
        }
        .header h1 { margin: 0; font-size: 24px; color: #f2f3f5; }
        .header p { margin: 5px 0 0; color: #949ba4; font-size: 14px; }
        
        .message-group {
            display: flex;
            margin-bottom: 16px; 
            padding-left: 16px; /* indent for reply structure if needed */
        }
        .avatar {
            width: 40px;
            height: 40px;
            border-radius: 50%;
            margin-right: 16px;
            object-fit: cover;
            background-color: #1e1f22;
            cursor: pointer;
        }
        .message-content {
            flex: 1;
            min-width: 0;
        }
        .meta {
            display: flex;
            align-items: center;
            margin-bottom: 4px;
        }
        .username {
            font-weight: 500;
            color: #f2f3f5;
            margin-right: 8px;
        }
        .timestamp {
            font-size: 12px;
            color: #949ba4;
        }
        .text {
            color: #dbdee1;
            white-space: pre-wrap; /* Preserve newlines */
            line-height: 1.375rem;
        }
        
        /* Embeds */
        .embed {
            margin-top: 8px;
            background-color: #2b2d31;
            border-left: 4px solid #1e1f22;
            padding: 12px;
            border-radius: 4px;
            max-width: 520px;
            display: grid;
            gap: 8px;
        }
        .embed-title { font-weight: 600; color: #f2f3f5; margin: 0; }
        .embed-desc { color: #dbdee1; white-space: pre-wrap; font-size: 14px; }
        .embed-footer { color: #949ba4; font-size: 12px; display: flex; align-items: center; margin-top: 8px; }
        .embed-image { max-width: 100%; border-radius: 4px; margin-top: 8px; }
        .embed-thumbnail { max-width: 80px; max-height: 80px; border-radius: 4px; margin-left: 16px; float: right; }

        /* Attachments */
        .attachment {
            margin-top: 8px;
            display: block;
        }
        .attachment img {
            max-width: 400px;
            max-height: 300px;
            border-radius: 4px;
            cursor: pointer;
        }
        .attachment a {
            color: #00a8fc;
            text-decoration: none;
        }
        .attachment a:hover { text-decoration: underline; }

        .bot-tag {
            background-color: #5865f2;
            color: white;
            font-size: 10px;
            padding: 1px 4px;
            border-radius: 3px;
            vertical-align: middle;
            margin-left: 4px;
            font-weight: 500;
            line-height: 1.3;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to ${guildName} Support</h1>
        <p>Transcript for Ticket ID: <strong>${ticketId}</strong> | Exported on ${new Date().toLocaleString()}</p>
    </div>
    
    <div class="chat-container">
        ${rows}
    </div>

    <script>
        // Optional: Simple image preview logic could go here
    </script>
</body>
</html>`;
    }

    private static renderMessage(msg: TicketMessage): string {
        const time = new Date(msg.created_at as any).toLocaleString(); // "as any" assuming kysely returns string/date based on driver
        const roleColor = msg.author_role_color || '#f2f3f5';

        let attachmentsHTML = '';
        let embedsHTML = '';

        // Parse attachments
        try {
            // Prisma returns parsed JSON, but checking just in case
            const atts = typeof msg.attachments === 'string' ? JSON.parse(msg.attachments) : msg.attachments;
            if (Array.isArray(atts)) {
                attachmentsHTML = atts.map((a: any) => {
                    const isImg = a.contentType?.startsWith('image/');
                    if (isImg) {
                        return `<div class="attachment"><a href="${a.url}" target="_blank"><img src="${a.url}" alt="Attachment"></a></div>`;
                    }
                    return `<div class="attachment"><a href="${a.url}" target="_blank">📄 ${a.name || 'Attachment'}</a></div>`;
                }).join('');
            }
        } catch (e) { }

        // Parse embeds
        try {
            const embeds = typeof msg.embeds === 'string' ? JSON.parse(msg.embeds) : msg.embeds;
            if (Array.isArray(embeds)) {
                embedsHTML = embeds.map((e: any) => {
                    const color = e.color ? `#${e.color.toString(16).padStart(6, '0')}` : '#1e1f22';
                    const title = e.title ? `<div class="embed-title">${e.title}</div>` : '';
                    const desc = e.description ? `<div class="embed-desc">${this.escapeHtml(e.description)}</div>` : '';
                    const image = e.image?.url ? `<img src="${e.image.url}" class="embed-image">` : '';
                    const thumb = e.thumbnail?.url ? `<img src="${e.thumbnail.url}" class="embed-thumbnail">` : '';
                    const footer = e.footer?.text ? `<div class="embed-footer">${e.footer.icon_url ? `<img src="${e.footer.icon_url}" style="width:16px;height:16px;border-radius:50%;margin-right:8px;">` : ''}${e.footer.text}</div>` : '';

                    return `
                    <div class="embed" style="border-left-color: ${color}">
                        ${thumb}
                        ${title}
                        ${desc}
                        ${image}
                        ${footer}
                    </div>`;
                }).join('');
            }
        } catch (e) { }

        return `
        <div class="message-group">
            <img src="${msg.author_avatar || 'https://cdn.discordapp.com/embed/avatars/0.png'}" class="avatar" alt="Avatar">
            <div class="message-content">
                <div class="meta">
                    <span class="username" style="color: ${roleColor}">${msg.author_name || 'Unknown User'}</span>
                    ${msg.sender_type === 'staff' ? '<span class="bot-tag">STAFF</span>' : ''}
                    <span class="timestamp">${time}</span>
                </div>
                <div class="text">${this.escapeHtml(msg.content)}</div>
                ${attachmentsHTML}
                ${embedsHTML}
            </div>
        </div>`;
    }

    private static escapeHtml(text: string): string {
        if (!text) return '';

        // 1. Basic Escaping
        let escaped = text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        // 2. Custom Emojis (<:name:id> or <a:name:id>)
        escaped = escaped.replace(/&lt;(a?):(\w{2,32}):(\d{17,19})&gt;/g, (match, animated, name, id) => {
            const ext = animated ? 'gif' : 'png';
            return `<img src="https://cdn.discordapp.com/emojis/${id}.${ext}" alt=":${name}:" style="width:22px;height:22px;vertical-align:bottom;">`;
        });

        // 3. Formatting
        return escaped
            .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>') // Simple Bold
            .replace(/\*(.*?)\*/g, '<i>$1</i>') // Simple Italic
            .replace(/__(.*?)__/g, '<u>$1</u>') // Simple Underline
            .replace(/`(.*?)`/g, '<code style="background:#2b2d31;padding:2px 4px;border-radius:3px;font-family:Consolas,monospace;">$1</code>') // Inline Code
            .replace(/\n/g, '<br>');
    }
}
