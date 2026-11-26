<script setup>
definePageMeta({ layout: 'manual' })
</script>

<template>
  <ManualPage slug="announcements" intro="หน้านี้รวมข่าวและกิจกรรมของบริษัท เปิดอ่านได้ตลอด ไม่ต้องขออนุมัติอะไร" :related="['holidays', 'home', 'admin-announcements']">
    <ManualStep :n="1" title="เปิดเมนู ประกาศ & กิจกรรม">
      <p>กดเมนู <b>ประกาศ & กิจกรรม</b> จะเห็นประกาศเป็นการ์ดเรียงกัน แต่ละใบมีป้าย <b>ข่าว</b> หรือ <b>กิจกรรม</b> ชื่อเรื่อง และข้อความย่อ</p>
      <ManualShot name="announcements-1" caption="หน้าประกาศ & กิจกรรม" />
      <p>ประกาศที่แอดมินปักไว้จะมีป้าย <b>📌 ปักหมุด</b></p>
    </ManualStep>

    <ManualStep :n="2" title="กรองดูเฉพาะที่สนใจ">
      <p>กดปุ่ม <b>ทั้งหมด</b>, <b>ข่าว</b> หรือ <b>กิจกรรม</b> ด้านบน ปุ่มที่เลือกอยู่จะเป็นสีเข้ม</p>
    </ManualStep>

    <ManualStep :n="3" title="เปิดอ่านรายละเอียด">
      <p>กดที่การ์ดที่อยากอ่าน จะมีหน้าต่างแสดงรูป ชื่อเรื่อง คนเขียน เวลาที่ประกาศ และเนื้อหาเต็ม อ่านจบแล้วกด <b>ปิด</b></p>
      <ManualShot name="announcements-2" caption="หน้าต่างรายละเอียดประกาศ" />
    </ManualStep>

    <ManualStep :n="4" title="ดูวันจัดกิจกรรม">
      <p>กิจกรรมที่มีวันจัดจะมีป้ายนับถอยหลัง</p>
      <ul class="list-disc space-y-1 pl-5">
        <li><b>อีก … วัน</b> ยังไม่ถึงวันจัด</li>
        <li><b>วันนี้</b> จัดวันนี้</li>
        <li><b>ผ่านไปแล้ว</b> จัดไปแล้ว</li>
      </ul>
      <ManualTip>ถ้าหน้านี้ว่าง และขึ้นว่า <b>ยังไม่มีประกาศ</b> แปลว่าแอดมินยังไม่ได้ลงประกาศ</ManualTip>
    </ManualStep>
  </ManualPage>
</template>
