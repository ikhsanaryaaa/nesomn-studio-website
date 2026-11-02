import './disposable.ts';
import sharp from '../../api/node_modules/sharp';
import { getStorage } from '../../api/src/lib/storage';
import { test, expect } from 'bun:test';
import { eq } from '../../api/node_modules/drizzle-orm';
import { app } from '../../api/src/index';
import { db } from '../../api/src/db/client';
import { users, assets, media } from '../../api/src/db/schema';
import { createSession } from '../../api/src/modules/session/service';
import { signToken } from '../../api/src/lib/jwt';

test('stable preview resolves fresh URL only for public referenced images or admins', async () => {
  const [admin] = await db.insert(users).values({email:crypto.randomUUID()+'@test.invalid',name:'Sample admin',role:'admin'}).returning();
  const token = await signToken({sub:admin!.id,role:'admin',sessionId:await createSession(admin!.id,null,null)});
  const cookie = 'nesomn_session='+token;
  let assetId: string | undefined;
  const ids: string[] = [];
  const uploadedKeys: string[] = [];
  try {
    const bytes = await sharp({create:{width:8,height:8,channels:3,background:'#ffffff'}}).png().toBuffer();
    const form = new FormData();form.append('file', new File([bytes], 'sample-preview.png', {type:'image/png'}));
    const upload = await app.handle(new Request('http://localhost/admin/uploads?kind=preview',{method:'POST',headers:{cookie},body:form}));
    expect(upload.status).toBe(200);
    const result = await upload.json();
    expect(result.previewPath).toMatch(/^\/api\/catalog\/preview\/[a-f0-9-]{36}$/);
    expect(result.previewPath).not.toContain('token=');
    for(const key of [result.fileKey,result.thumbKey].filter(Boolean)){uploadedKeys.push(key);const row=await db.query.media.findFirst({where:eq(media.key,key)});if(row)ids.push(row.id);}
    const draftPreview=await app.handle(new Request('http://localhost'+result.previewPath.replace('/api',''),{headers:{cookie}}));
    expect(draftPreview.status).toBe(302);
    const [image] = await db.insert(media).values({key:'assets/sample-preview.webp',mimeType:'image/webp',ownerId:admin!.id,sizeBytes:64}).returning();
    const [product] = await db.insert(media).values({key:'private/sample.glb',mimeType:'model/gltf-binary',ownerId:admin!.id,sizeBytes:64}).returning();
    ids.push(image!.id,product!.id);
    const path='/api/catalog/preview/'+image!.id;
    const request = (id:string, auth=false) => app.handle(new Request('http://localhost/catalog/preview/'+id,{headers:auth?{cookie}:{}}));
    expect((await request(image!.id)).status).toBe(404);
    expect((await request(image!.id,true)).status).toBe(302);
    const [asset] = await db.insert(assets).values({slug:crypto.randomUUID(),title:'Sample preview test',type:'mockup2d',status:'draft',previews:[path]}).returning();assetId=asset!.id;
    expect((await request(image!.id)).status).toBe(404);
    await db.update(assets).set({status:'published'}).where(eq(assets.id,assetId));
    const response = await request(image!.id);expect(response.status).toBe(302);expect(response.headers.get('cache-control')).toBe('no-store');expect(response.headers.get('location')).toContain('token=');
    await db.update(assets).set({previews:['/api/catalog/preview/'+product!.id]}).where(eq(assets.id,assetId));
    expect((await request(product!.id)).status).toBe(404);expect((await request(product!.id,true)).status).toBe(404);
    expect((await request(image!.id)).status).toBe(404);
    for(const resource of ['subscriptions','credit-ledger']){expect((await app.handle(new Request('http://localhost/admin/'+resource))).status).toBe(401);expect((await app.handle(new Request('http://localhost/admin/'+resource,{headers:{cookie}}))).status).toBe(200);}
  } finally {
    if(assetId)await db.delete(assets).where(eq(assets.id,assetId));
    for(const key of uploadedKeys)await (await getStorage()).delete(key);
    for(const id of ids)await db.delete(media).where(eq(media.id,id));
    await db.delete(users).where(eq(users.id,admin!.id));
  }
});
