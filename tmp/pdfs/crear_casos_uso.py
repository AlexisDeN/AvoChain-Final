from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib import colors
from reportlab.pdfbase.pdfmetrics import stringWidth
from pathlib import Path

OUT = Path('output/pdf/Casos_de_uso_AvoChain_ordenados.pdf')
W, H = landscape(A4)
NAVY = colors.HexColor('#142333')
GREEN = colors.HexColor('#74c51b')
PALE = colors.HexColor('#eff7e8')
INK = colors.HexColor('#17212b')
MUTED = colors.HexColor('#526170')
LINE = colors.HexColor('#536779')
WHITE = colors.white

c = canvas.Canvas(str(OUT), pagesize=(W, H))
c.setTitle('Casos de uso AvoChain - version ordenada')

def header(title, subtitle, page, total=6):
    c.setFillColor(NAVY); c.rect(0, H-76, W, 76, fill=1, stroke=0)
    c.setFillColor(GREEN); c.rect(0, H-76, 9, 76, fill=1, stroke=0)
    c.setFillColor(WHITE); c.setFont('Helvetica-Bold', 20); c.drawString(30, H-36, title)
    c.setFont('Helvetica', 10); c.setFillColor(colors.HexColor('#d7e1ea')); c.drawString(30, H-56, subtitle)
    c.setFillColor(MUTED); c.setFont('Helvetica', 8); c.drawRightString(W-24, 16, f'AvoChain | Casos de uso | {page}/{total}')

def wrapped_lines(text, font, size, max_width):
    words = text.split()
    lines=[]; line=''
    for word in words:
        candidate = (line+' '+word).strip()
        if stringWidth(candidate, font, size) <= max_width:
            line = candidate
        else:
            if line: lines.append(line)
            line = word
    if line: lines.append(line)
    return lines

def actor(x, y, label):
    c.setStrokeColor(INK); c.setLineWidth(1.3)
    c.circle(x, y+20, 9, stroke=1, fill=0)
    c.line(x, y+11, x, y-15)
    c.line(x-14, y+2, x+14, y+2)
    c.line(x, y-15, x-12, y-31)
    c.line(x, y-15, x+12, y-31)
    c.setFillColor(INK); c.setFont('Helvetica-Bold', 9)
    lines=wrapped_lines(label, 'Helvetica-Bold', 9, 76)
    yy=y-45
    for line in lines:
        c.drawCentredString(x, yy, line); yy-=11

def ellipse_case(cx, cy, width, height, label, fill=PALE, font_size=9):
    c.setFillColor(fill); c.setStrokeColor(colors.HexColor('#36516a')); c.setLineWidth(1)
    c.ellipse(cx-width/2, cy-height/2, cx+width/2, cy+height/2, fill=1, stroke=1)
    lines=[]
    for segment in label.split('\n'):
        lines.extend(wrapped_lines(segment, 'Helvetica', font_size, width-24))
    total=len(lines)*11
    c.setFillColor(INK); c.setFont('Helvetica', font_size)
    yy=cy+total/2-8
    for line in lines:
        c.drawCentredString(cx, yy, line); yy-=11

def connector(x1,y1,x2,y2,dashed=False,arrow=False):
    c.saveState(); c.setStrokeColor(LINE); c.setLineWidth(1)
    if dashed: c.setDash(4,3)
    c.line(x1,y1,x2,y2)
    if arrow:
        import math
        angle=math.atan2(y2-y1,x2-x1)
        a=6
        p1=(x2-a*math.cos(angle-0.45), y2-a*math.sin(angle-0.45))
        p2=(x2-a*math.cos(angle+0.45), y2-a*math.sin(angle+0.45))
        path=c.beginPath(); path.moveTo(x2,y2); path.lineTo(*p1); path.lineTo(*p2); path.close()
        c.setFillColor(LINE); c.drawPath(path,fill=1,stroke=0)
    c.restoreState()

def note(x,y,w,h,text):
    c.setFillColor(colors.HexColor('#fff9df')); c.setStrokeColor(colors.HexColor('#d1b85d')); c.roundRect(x,y,w,h,5,fill=1,stroke=1)
    lines=[]
    for para in text.split('\n'):
        lines.extend(wrapped_lines(para,'Helvetica',8,w-16))
    c.setFillColor(INK); c.setFont('Helvetica',8); yy=y+h-14
    for line in lines:
        c.drawString(x+8,yy,line); yy-=10

def panel(x,y,w,h,title, role, cases, note_text=None):
    c.setFillColor(colors.HexColor('#f8fafc')); c.setStrokeColor(colors.HexColor('#8b9aaa')); c.roundRect(x,y,w,h,8,fill=1,stroke=1)
    c.setFillColor(NAVY); c.setFont('Helvetica-Bold',11); c.drawString(x+12,y+h-20,title)
    # UML system boundary, keeping the actor outside it.
    bx=x+84; by=y+34; bw=w-98; bh=h-66
    c.setStrokeColor(colors.HexColor('#526779')); c.setLineWidth(1); c.rect(bx,by,bw,bh,fill=0,stroke=1)
    c.setFillColor(MUTED); c.setFont('Helvetica',7); c.drawString(bx+8,by+bh-12,'Sistema AvoChain')
    actor(x+40,y+h/2-2,role)
    # Cases as (label, cxrel, cyrel, width, height)
    for item in cases:
        label, cxr, cyr, ew, eh = item[:5]
        ellipse_case(x+cxr,y+cyr,ew,eh,label)
        # Association to main actor; all paths fan out monotonically, so they do not cross.
        if len(item) < 6 or item[5]:
            connector(x+54,y+h/2-2,x+cxr-ew/2-1,y+cyr)
    if note_text:
        nx=x+100; nw=w-116; nh=58; ny=y+43
        note(nx,ny,nw,nh,note_text)
    return x,y

# Page 1: Producer and quality, in separate system views.
header('Casos de uso operativos: producción y calidad','Cada rol queda en su propio módulo; las validaciones aparecen junto a la acción que las requiere.',1)
panel(25,85,390,440,'Producción','Productor',[
    ('Registrar lote',175,315,130,42),('Consultar mis lotes',175,225,145,42),('Adjuntar evidencia\nfotográfica',315,315,120,42,False)
])
# The optional extension is local to the registration case.
connector(265,400,280,400,True,True)
c.setFillColor(MUTED); c.setFont('Helvetica-Oblique',7); c.drawCentredString(272,410,'<<extend>>')
panel(427,85,390,440,'Inspección de calidad','Inspector de calidad',[
    ('Inspeccionar calidad',165,315,145,44),('Validar humedad, temperatura\ny destino',305,375,140,48,False),('Adjuntar informe PDF',305,255,140,44,False)
])
connector(662,400,662,450,True,True); c.setFont('Helvetica-Oblique',7); c.drawString(666,427,'<<include>>')
connector(662,400,662,340,True,True); c.drawString(666,367,'<<include>>')
c.showPage()

# Page 2: Bodega and transport, separate role groups.
header('Casos de uso operativos: bodega y transporte','El despacho inicia el trayecto; el conductor documenta avance e incidentes.',2)
panel(25,85,390,440,'Preparación y despacho','Bodeguero',[
    ('Generar QR del lote',205,330,165,44),('Asignar conductor y\nregistrar ruta',205,225,170,48)
], 'Precondición: el lote debe tener la calidad aprobada. El rechazo bloquea el QR y el despacho.')
panel(427,85,390,440,'Seguimiento en ruta','Conductor / Transportador',[
    ('Consultar lotes y ruta\nasignados',205,385,175,48),('Registrar lectura QR',205,315,165,42),('Registrar punto de control',205,245,175,42),('Reportar incidente',205,175,165,42)
])
c.showPage()

# Page 3: Receiver.
header('Casos de uso operativos: recepción en destino','La recepción del receptor cierra la custodia del transportador.',3)
panel(120,105,600,410,'Recepción del lote','Receptor',[
    ('Confirmar recepción\nen destino',435,365,210,50),('Validar estado, rol,\ntemperatura y daños',435,260,210,50,False)
], 'Al confirmar, se registra quién recibió, temperatura, cajas dañadas y hora; el lote pasa a En Punto de Venta.')
connector(555,445,555,390,True,True); c.setFillColor(MUTED); c.setFont('Helvetica-Oblique',8); c.drawString(563,412,'<<include>>')
c.showPage()

# Page 4: Seller and public origin lookup in two clean views.
header('Casos de uso: venta y consulta pública','La venta es una acción del vendedor; consultar el origen también está disponible al cliente final.',4)
panel(25,85,390,440,'Venta en punto de venta','Vendedor',[
    ('Consultar origen e\nhistorial del lote',205,330,180,48),('Registrar venta del lote',205,225,180,44)
])
panel(427,85,390,440,'Consulta pública','Cliente final',[
    ('Consultar origen, calidad,\nrecorrido y recepción',205,330,190,52)
], 'Si el lote ya fue vendido, se presenta su historial y se advierte que el QR no debe reutilizarse.')
c.showPage()

# Page 5: Administration, grouped by account and operation.
header('Casos de uso: administración','Funciones globales disponibles para el rol Administrador.',5)
panel(65,90,710,430,'Gestión y supervisión del sistema','Administrador',[
    ('Registrar y gestionar\nusuarios y roles',460,385,210,50),('Registrar y editar fincas',460,310,210,46),('Buscar y filtrar usuarios,\nfincas y lotes',460,235,220,50),('Consultar dashboard y\ntrazabilidad global',460,160,220,50)
], 'El Administrador consulta todos los lotes por su rol. El plan Premium no habilita ni restringe estas funciones administrativas.')
c.showPage()

# Page 6: Premium, clearly separated from administration.
header('Casos de uso: Premium del productor','Premium amplía el seguimiento de los lotes propios del productor.',6)
panel(65,90,710,430,'Plan y seguimiento Premium','Productor',[
    ('Consultar la lista\nde mis lotes',420,390,200,48),('Pagar plan Premium',420,315,200,46),('Consultar detalle completo\nde mis lotes',420,240,220,50),('Generar informe PDF\nde producción',420,165,210,50)
])
# Payment service actor on the right, linked only to payment.
actor(740,90+315,'Pasarela Wompi')
connector(585,405,726,405)
note(520,105,240,42,'El detalle y el informe requieren Premium activo. El productor solo puede consultar sus propios lotes.')
c.save()
print(OUT.resolve())
