package com.thesis.smart_resource_planner.service;

import com.thesis.smart_resource_planner.exception.DuplicateResourceException;
import com.thesis.smart_resource_planner.exception.ResourceNotFoundException;
import com.thesis.smart_resource_planner.model.dto.SkillDTO;
import com.thesis.smart_resource_planner.model.entity.Skill;
import com.thesis.smart_resource_planner.repository.SkillRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

/**
 * Service for skill management operations.
 *
 * <p>
 * Provides CRUD operations for skills used to categorise employee
 * competencies and task requirements. Supports lookup by ID, name,
 * and category, as well as an upsert helper that creates a skill on
 * the fly if it does not yet exist.
 * </p>
 */
@Service
@RequiredArgsConstructor
@Slf4j
@Transactional
public class SkillService {

    private final SkillRepository skillRepository;
    private final ModelMapper modelMapper;

    /**
     * Creates a new skill.
     *
     * @param skillDTO DTO containing the skill name, category, and description
     * @return the saved {@link SkillDTO}
     * @throws com.thesis.smart_resource_planner.exception.DuplicateResourceException if
     *                                                                                a
     *                                                                                skill
     *                                                                                with
     *                                                                                the
     *                                                                                same
     *                                                                                name
     *                                                                                already
     *                                                                                exists
     */
    public SkillDTO createSkill(SkillDTO skillDTO) {
        if (skillRepository.existsByName(skillDTO.getName())) {
            throw new DuplicateResourceException("Skill already exists");
        }

        Skill skill = modelMapper.map(skillDTO, Skill.class);
        Skill saved = skillRepository.save(skill);

        return modelMapper.map(saved, SkillDTO.class);
    }

    /**
     * Retrieves a skill by its UUID.
     *
     * @param id UUID of the skill
     * @return the matching {@link SkillDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    @Transactional(readOnly = true)
    public SkillDTO getSkillById(UUID id) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));
        return modelMapper.map(skill, SkillDTO.class);
    }

    /**
     * Retrieves a skill by its exact name (case-sensitive).
     *
     * @param name the skill name
     * @return the matching {@link SkillDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    @Transactional(readOnly = true)
    public SkillDTO getSkillByName(String name) {
        Skill skill = skillRepository.findByName(name)
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));
        return modelMapper.map(skill, SkillDTO.class);
    }

    /**
     * Returns all skills in the system.
     *
     * @return list of all {@link SkillDTO} objects
     */
    @Transactional(readOnly = true)
    public List<SkillDTO> getAllSkills() {
        return skillRepository.findAll().stream()
                .map(skill -> modelMapper.map(skill, SkillDTO.class))
                .toList();
    }

    /**
     * Returns all skills that belong to a given category.
     *
     * @param category the category name to filter by
     * @return list of matching {@link SkillDTO} objects
     */
    @Transactional(readOnly = true)
    public List<SkillDTO> getSkillsByCategory(String category) {
        return skillRepository.findByCategory(category).stream()
                .map(skill -> modelMapper.map(skill, SkillDTO.class))
                .toList();
    }

    /**
     * Returns an existing skill (case-insensitive lookup) or creates one with the
     * default "Custom" category if none is found.
     *
     * @param skillName the name to look up or create
     * @return the existing or newly created {@link SkillDTO}
     */
    @Transactional
    public SkillDTO getOrCreateSkill(String skillName) {
        return skillRepository.findByNameIgnoreCase(skillName)
                .map(skill -> modelMapper.map(skill, SkillDTO.class))
                .orElseGet(() -> {
                    Skill newSkill = Skill.builder()
                            .name(skillName)
                            .category("Custom") // Default category
                            .description("Dynamically created skill")
                            .build();

                    Skill saved = skillRepository.save(newSkill);
                    return modelMapper.map(saved, SkillDTO.class);
                });
    }

    /**
     * Updates an existing skill's name, category, or description.
     *
     * @param id       UUID of the skill to update
     * @param skillDTO DTO containing the updated fields (null fields are ignored)
     * @return the updated {@link SkillDTO}
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException  if
     *                                                                                not
     *                                                                                found
     * @throws com.thesis.smart_resource_planner.exception.DuplicateResourceException if
     *                                                                                the
     *                                                                                new
     *                                                                                name
     *                                                                                conflicts
     *                                                                                with
     *                                                                                an
     *                                                                                existing
     *                                                                                skill
     */
    public SkillDTO updateSkill(UUID id, SkillDTO skillDTO) {
        Skill skill = skillRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Skill not found"));

        if (skillDTO.getName() != null && !skillDTO.getName().equals(skill.getName())) {
            if (skillRepository.existsByName(skillDTO.getName())) {
                throw new DuplicateResourceException("Skill name already exists");
            }
            skill.setName(skillDTO.getName());
        }

        if (skillDTO.getCategory() != null) {
            skill.setCategory(skillDTO.getCategory());
        }

        if (skillDTO.getDescription() != null) {
            skill.setDescription(skillDTO.getDescription());
        }

        Skill updated = skillRepository.save(skill);

        return modelMapper.map(updated, SkillDTO.class);
    }

    /**
     * Permanently deletes a skill by its ID.
     *
     * @param id UUID of the skill to delete
     * @throws com.thesis.smart_resource_planner.exception.ResourceNotFoundException if
     *                                                                               not
     *                                                                               found
     */
    public void deleteSkill(UUID id) {

        if (!skillRepository.existsById(id)) {
            throw new ResourceNotFoundException("Skill not found");
        }

        skillRepository.deleteById(id);
    }
}
