from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from reportlab.lib import colors
from pathlib import Path

out=Path('public/documentos/formulario-vinculacion-avochain.pdf')
c=canvas.Canvas(str(out),pagesize=letter)
w,h=letter
navy=colors.HexColor('#153047'); green=colors.HexColor('#72bf1b'); muted=colors.HexColor('#536373')

def header(title,subtitle,page):
    c.setFillColor(navy); c.rect(0,h-92,w,92,fill=1,stroke=0)
    c.setFillColor(green); c.rect(0,h-92,8,92,fill=1,stroke=0)
    c.setFillColor(colors.white); c.setFont('Helvetica-Bold',18); c.drawString(34,h-40,title)
    c.setFont('Helvetica',9); c.drawString(34,h-61,subtitle)
    c.setFillColor(muted); c.setFont('Helvetica',8); c.drawString(34,24,f'AvoChain | Solicitud de vinculacion | Pagina {page} de 2')

def label(text,x,y):
    c.setFillColor(navy); c.setFont('Helvetica-Bold',9); c.drawString(x,y,text)

header('Formulario de vinculacion AvoChain','Solicitud de acceso al sistema. Completa este formulario y adjunta los soportes solicitados.',1)
c.setFillColor(colors.HexColor('#f3f8ed')); c.setStrokeColor(colors.HexColor('#d6e6c6')); c.roundRect(34,650,w-68,42,7,fill=1,stroke=1)
c.setFillColor(navy); c.setFont('Helvetica-Bold',10); c.drawString(46,674,'Antes de enviar')
c.setFont('Helvetica',8.5); c.drawString(46,659,'La solicitud queda pendiente de revision. La cuenta se crea solo despues de la aprobacion administrativa.')

fields=[('Nombre completo','nombre',34,600,260),('Correo electronico','correo',324,600,254),('Tipo y numero de documento','documento',34,535,260),('Telefono de contacto','telefono',324,535,254),('Municipio / ciudad','municipio',34,470,260),('Rol solicitado','rol',324,470,254),('Finca o empresa relacionada (si aplica)','finca',34,405,544)]
for text,name,x,y,width in fields:
    label(text,x,y+24); c.acroForm.textfield(name=name,tooltip=text,x=x,y=y,width=width,height=19,borderColor=muted,fillColor=colors.white,textColor=navy,borderWidth=0.8,forceBorder=True,fontName='Helvetica',fontSize=9)
label('Motivo de la solicitud / informacion adicional',34,365)
c.acroForm.textfield(name='motivo',tooltip='Motivo de la solicitud',x=34,y=260,width=544,height=92,borderColor=muted,fillColor=colors.white,textColor=navy,borderWidth=0.8,forceBorder=True,fontName='Helvetica',fontSize=9,fieldFlags='multiline')
c.setFillColor(muted); c.setFont('Helvetica',8); c.drawString(34,232,'No envies contrasenas, informacion bancaria ni documentos que no sean necesarios para validar tu vinculacion.')
c.showPage()

header('Documentos y declaracion','Marca los soportes que adjuntas. La administracion puede solicitar informacion adicional segun el rol.',2)
checks=[('documento_identidad','Copia legible del documento de identidad.'),('soporte_rol','Soporte relacionado con el rol solicitado (por ejemplo, productor, calidad, transporte, bodega, recepcion o venta).'),('soporte_empresa','Documento o referencia de la finca, empresa o establecimiento relacionado, si aplica.'),('autorizacion_datos','Autorizo el uso de mis datos para revisar esta solicitud y gestionar mi acceso a AvoChain.'),('informacion_veraz','Declaro que la informacion entregada es correcta y que los soportes me pertenecen o estoy autorizado a presentarlos.')]
y=690
for name,text in checks:
    c.acroForm.checkbox(name=name,tooltip=text,x=42,y=y-4,size=13,borderColor=muted,fillColor=colors.white,textColor=green,borderWidth=0.8,buttonStyle='check',checked=False,forceBorder=True)
    lines=[]; words=text.split(); line=''
    for word in words:
        if len((line+' '+word).strip())>84:
            lines.append(line); line=word
        else: line=(line+' '+word).strip()
    if line: lines.append(line)
    c.setFillColor(navy); c.setFont('Helvetica',9)
    for i,line in enumerate(lines): c.drawString(64,y+2-i*12,line)
    y-=max(43,len(lines)*13+20)

c.setFillColor(colors.HexColor('#fff8dd')); c.setStrokeColor(colors.HexColor('#e0c86b')); c.roundRect(34,360,w-68,92,7,fill=1,stroke=1)
c.setFillColor(navy); c.setFont('Helvetica-Bold',9); c.drawString(46,431,'Requisitos generales')
notes=['Adjunta el formulario diligenciado y firmado.','Incluye documento de identidad y soportes relacionados con el rol solicitado.','La administracion verificara la solicitud y enviara la decision al correo registrado.','Si se aprueba, recibiras un enlace de un solo uso para activar la cuenta y crear tu contrasena.']
c.setFont('Helvetica',8.5)
for i,line in enumerate(notes): c.drawString(48,414-i*14,'- '+line)
label('Firma del solicitante',34,318)
c.acroForm.textfield(name='firma',tooltip='Firma del solicitante',x=34,y=282,width=340,height=24,borderColor=muted,fillColor=colors.white,textColor=navy,borderWidth=0.8,forceBorder=True,fontName='Helvetica',fontSize=9)
label('Fecha',400,318)
c.acroForm.textfield(name='fecha',tooltip='Fecha',x=400,y=282,width=178,height=24,borderColor=muted,fillColor=colors.white,textColor=navy,borderWidth=0.8,forceBorder=True,fontName='Helvetica',fontSize=9)
c.setFillColor(muted); c.setFont('Helvetica-Oblique',8); c.drawString(34,248,'Este formato es una guia general del prototipo AvoChain. La empresa debe confirmar sus requisitos especificos antes de usarlo formalmente.')
c.save()
print(out.resolve())
