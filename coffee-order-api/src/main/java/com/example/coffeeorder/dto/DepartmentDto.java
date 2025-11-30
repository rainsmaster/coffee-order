package com.example.coffeeorder.dto;

import com.example.coffeeorder.entity.Department;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class DepartmentDto {

    private Long id;
    private String name;
    private LocalDateTime createdDate;

    public static DepartmentDto from(Department department) {
        DepartmentDto dto = new DepartmentDto();
        dto.setId(department.getId());
        dto.setName(department.getName());
        dto.setCreatedDate(department.getCreatedDate());
        return dto;
    }
}
