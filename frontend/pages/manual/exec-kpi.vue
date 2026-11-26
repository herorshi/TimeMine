<script setup>
definePageMeta({ layout: 'manual' })
</script>

<template>
  <ManualPage slug="exec-kpi" intro="หน้านี้แสดงผลประเมิน KPI ประจำปีของพนักงานทุกคน เรียงคะแนนจากมากไปน้อย ผู้บริหารดูได้อย่างเดียว การให้คะแนนทำที่หน้าของ Admin" :related="['admin-kpi','kpi','exec-overview']">
    <ManualStep :n="1" title="เปิดเมนู KPI Dashboard">
      <p>กดเมนู <b>KPI Dashboard</b> แล้วเลือก <b>ปี</b> มุมขวาบน (แสดงเป็น พ.ศ.)</p>
      <ManualShot name="exec-kpi-1" caption="หน้า KPI Dashboard" />
      <ManualTip type="info">ถ้าปีนั้นยังไม่มีผลประเมิน จะขึ้น "ยังไม่มีผลประเมินในปีนี้" ผลประเมินสร้างโดย Admin ดู <ManualLink to="admin-kpi" /></ManualTip>
    </ManualStep>

    <ManualStep :n="2" title="อ่านการ์ดสรุป">
      <ul class="list-disc space-y-1 pl-6">
        <li><b>คะแนนเฉลี่ย</b> จากคะแนนเต็ม 100</li>
        <li><b>ประเมินแล้ว</b> จำนวนคนที่ผลประเมินเป็นฉบับจริง (ไม่นับฉบับร่าง)</li>
        <li><b>เกรด A</b> จำนวนคนที่ได้เกรด A</li>
      </ul>
    </ManualStep>

    <ManualStep :n="3" title="ดู คนทำดีเด่น">
      <p>ถัดมาคือแท่นรับรางวัล 3 อันดับแรก 🥇🥈🥉 บอกชื่อ แผนก คะแนนรวม และเกรด</p>
    </ManualStep>

    <ManualStep :n="4" title="อ่านตารางอันดับทั้งหมด">
      <p>ตารางมีคะแนนแต่ละด้าน คือ เข้างาน คุณภาพ ผลงาน ทีมเวิร์ก รับผิดชอบ แล้วตามด้วย <b>คะแนนรวม</b> และ <b>เกรด</b> สีของแถวตามเกรด คนเกรด A มีเครื่องหมาย ⭐</p>
      <p>เกรดดูจากคะแนนรวม</p>
      <ul class="list-disc space-y-1 pl-6">
        <li>A = 90 ขึ้นไป</li>
        <li>B = 80 ถึง 89</li>
        <li>C = 70 ถึง 79</li>
        <li>D = 60 ถึง 69</li>
        <li>F = ต่ำกว่า 60</li>
      </ul>
      <ManualTip type="info">แถวที่มีป้าย <b>ฉบับร่าง</b> แปลว่า Admin ยังประเมินไม่เสร็จ จะยังไม่ติดอันดับบนแท่นรับรางวัล</ManualTip>
      <ManualTip>กดหัวคอลัมน์เพื่อเรียง หรือเลือกกรองตามแผนกและเกรดได้ในช่องใต้หัวคอลัมน์</ManualTip>
    </ManualStep>

    <ManualStep :n="5" title="ดูกราฟด้านล่าง">
      <p>มี 2 กราฟ คือ <b>การกระจายเกรด</b> (วงกลมแบ่งตามเกรด A ถึง F) และ <b>คะแนนเฉลี่ยแยกตามแผนก</b></p>
      <ManualShot name="exec-kpi-2" caption="กราฟการกระจายเกรดและคะแนนเฉลี่ยตามแผนก" />
    </ManualStep>
  </ManualPage>
</template>
