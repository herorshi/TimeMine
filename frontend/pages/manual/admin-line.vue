<script setup>
// LINE check-in alerts (backend/src/lib/line.js, message text from backend/src/routes/attendance.js checkInMessage).
// No app page: recipients are set by the system owner in LINE_ADMIN_USER_IDS.
definePageMeta({ layout: 'manual' })
const samples = [
  { title: 'มาตรงเวลา ที่ตึก', lines: ['🟢 เข้างาน', 'สมชาย รักงาน (E001) · Engineering', 'เวลา 08:52 น. · 🏬 Building', '✅ ยืนยันใบหน้าแล้ว'] },
  { title: 'มาสาย ที่ Office', lines: ['🟢 เข้างาน', 'อนันต์ มั่นคง (E003) · Sales', 'เวลา 09:17 น. · 🏢 Office', '⚠️ สาย 12 นาที'] },
  { title: 'Work from Home', lines: ['🟢 เข้างาน', 'มาลี สดใส (E004) · Marketing', 'เวลา 08:58 น. · 🏠 WFH', 'รออนุมัติ'] },
]
</script>

<template>
  <ManualPage slug="admin-line" intro="ทุกครั้งที่พนักงานลงเวลาเข้างานสำเร็จ ระบบจะส่งข้อความ LINE มาบอก Admin ทันที ไม่ต้องเปิดเว็บก็รู้ว่าใครเข้างานแล้ว ใครมาสาย และใครขอ WFH" :related="['admin-attendance', 'checkin', 'admin-settings']">
    <ManualStep :n="1" title="ข้อความที่จะได้รับหน้าตาเป็นแบบนี้">
      <p>ข้อความมาจาก LINE Official Account ของบริษัท ส่งมาทันทีที่พนักงานกดลงเวลาเข้างานสำเร็จ ไม่ว่าจะลงแบบ Office, ที่ตึก หรือ WFH</p>
      <div class="grid gap-3 sm:grid-cols-3">
        <figure v-for="s in samples" :key="s.title" class="rounded-xl border border-slate-200 p-3" style="background:#8cabd9">
          <div class="rounded-2xl bg-white px-3 py-2 text-sm leading-relaxed text-slate-800 shadow-sm" style="border-top-left-radius:4px">
            <p v-for="l in s.lines" :key="l">{{ l }}</p>
          </div>
          <figcaption class="mt-2 text-center text-xs font-medium text-white">{{ s.title }}</figcaption>
        </figure>
      </div>
      <p class="text-xs text-slate-400">ภาพจำลองข้อความ ชื่อในตัวอย่างเป็นข้อมูลสมมติ</p>
    </ManualStep>

    <ManualStep :n="2" title="อ่านข้อความยังไง">
      <ul class="space-y-1 pl-5" style="list-style:disc">
        <li><b>บรรทัดที่ 2</b> ชื่อพนักงาน (รหัสพนักงาน) · แผนก</li>
        <li><b>บรรทัดที่ 3</b> เวลาที่เข้างาน และแบบที่ลง: 🏢 Office, 🏬 Building (ที่ตึก), 🏠 WFH</li>
        <li><b>⚠️ สาย … นาที</b> ขึ้นเฉพาะคนที่เข้างานเกินเวลาที่ตั้งไว้ใน <ManualLink to="admin-settings" /></li>
        <li><b>✅ ยืนยันใบหน้าแล้ว</b> ขึ้นเฉพาะการลงเวลาที่ตึก ที่สแกนหน้าผ่าน</li>
        <li><b>รออนุมัติ</b> ขึ้นเฉพาะ WFH แปลว่าต้องเข้าไปอนุมัติในหน้า <ManualLink to="admin-attendance" /></li>
      </ul>
      <ManualTip type="info">ระบบแจ้งเฉพาะตอน <b>เข้างาน</b> ตอนออกงานไม่มีข้อความ LINE</ManualTip>
    </ManualStep>

    <ManualStep :n="3" title="ถ้าเป็น WFH: เข้าไปอนุมัติในระบบ">
      <p>ข้อความ LINE เป็นแค่การแจ้งเตือน กดอนุมัติใน LINE ไม่ได้ ให้เปิดเมนู "การเข้างาน / อนุมัติ WFH" แล้วกดอนุมัติหรือไม่อนุมัติตามขั้นตอนใน <ManualLink to="admin-attendance" /></p>
    </ManualStep>

    <ManualStep :n="4" title="อยากเริ่มรับ (หรือเลิกรับ) ข้อความ ต้องทำยังไง">
      <p>รายชื่อคนที่ได้รับข้อความ <b>ไม่ได้ตั้งในหน้าเว็บ</b> ผู้ดูแลระบบ (ฝ่าย IT) เป็นคนเพิ่มหรือลบให้ ทำตามนี้:</p>
      <ol class="space-y-1 pl-5" style="list-style:decimal">
        <li>ขอ QR code ของ LINE Official Account บริษัทจากฝ่าย IT แล้วกด <b>เพิ่มเพื่อน</b> (ถ้าบล็อกไว้ จะไม่ได้รับข้อความ)</li>
        <li>แจ้งฝ่าย IT ว่าต้องการรับแจ้งเตือนการเข้างาน ฝ่าย IT จะหา <b>LINE User ID</b> ของคุณแล้วเพิ่มเข้าระบบให้</li>
        <li>ลองให้พนักงานสักคนลงเวลาเข้างาน ถ้าตั้งค่าถูก ข้อความจะเด้งเข้ามาภายในไม่กี่วินาที</li>
      </ol>
      <ManualTip type="warn" title="LINE User ID ไม่ใช่ LINE ID">LINE ID ที่ใช้ค้นหาเพื่อน (เช่น @somporn) ใช้ไม่ได้ ระบบต้องใช้ User ID ภายในของ LINE ซึ่งขึ้นต้นด้วยตัว U และยาว 33 ตัวอักษร ฝ่าย IT จะเป็นคนหาให้</ManualTip>
    </ManualStep>

    <section class="rounded-2xl border border-slate-200 p-5">
      <h2 class="mb-3 font-semibold text-slate-700">ถ้าเจอปัญหา</h2>
      <dl class="space-y-3 text-[15px] leading-relaxed text-slate-600">
        <div>
          <dt class="font-medium text-slate-800">พนักงานลงเวลาแล้ว แต่ไม่มีข้อความ LINE</dt>
          <dd>ดูก่อนว่าการลงเวลาสำเร็จจริงในหน้า <ManualLink to="admin-attendance" /> ถ้าสำเร็จแล้วแต่ยังไม่มีข้อความ ให้เช็กว่ายังเป็นเพื่อนกับ LINE Official Account อยู่ (ไม่ได้บล็อก) แล้วแจ้งฝ่าย IT ให้ตรวจว่าชื่อคุณอยู่ในรายชื่อผู้รับ</dd>
        </div>
        <div>
          <dt class="font-medium text-slate-800">ข้อความ LINE มาช้าหรือไม่มา แต่ในเว็บมีรายการแล้ว</dt>
          <dd>การลงเวลาไม่ขึ้นกับ LINE ถ้า LINE ส่งไม่สำเร็จ การลงเวลาของพนักงานยังบันทึกครบตามปกติ ดูข้อมูลที่ถูกต้องในหน้าเว็บได้เสมอ</dd>
        </div>
      </dl>
    </section>
  </ManualPage>
</template>
